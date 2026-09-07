/**
 * Server-side key/value store behind everything that needs cross-request state:
 * share links, the extraction cache, AI-fallback quotas, and per-IP rate limits.
 *
 * Two interchangeable backends, picked from env at call time:
 *  - 'redis'    Vercel KV / Upstash Redis via @vercel/kv (KV_REST_API_URL + KV_REST_API_TOKEN).
 *  - 'supabase' A `kv_store` table + `kv_incr` RPC in the production Supabase project,
 *               reached over PostgREST with the service-role key (never the anon key —
 *               the table has RLS enabled and no policies). Requires
 *               SUPABASE_SERVICE_ROLE_KEY plus SUPABASE_URL or PUBLIC_SUPABASE_URL,
 *               and the migration in supabase-kv-migration.sql.
 *
 * Redis wins when both are configured; set SERVER_STORE=supabase to override (e.g. while
 * stale KV_REST_API_* vars still exist in Vercel).
 *
 * All three operations THROW on backend failure. Callers decide per feature whether that
 * fails open (cache, quotas, rate limits) or surfaces to the user (share links), and use
 * logStoreError() so a dead backend is visible in the logs instead of silently absorbed.
 */

export type StoreBackend = 'redis' | 'supabase';

const SUPABASE_TIMEOUT_MS = 5_000;

function env(name: string): string | undefined {
  // import.meta.env for Astro/Vite builds, process.env for the Vercel runtime and scripts.
  const meta = (import.meta as any)?.env?.[name];
  return (typeof meta === 'string' && meta) || process.env[name] || undefined;
}

function supabaseConfig(): { url: string; serviceKey: string } | null {
  const url = env('SUPABASE_URL') || env('PUBLIC_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && serviceKey ? { url: url.replace(/\/+$/, ''), serviceKey } : null;
}

function redisConfigured(): boolean {
  return !!(env('KV_REST_API_URL') && env('KV_REST_API_TOKEN'));
}

/** Which backend calls will use right now, or null when neither is configured. */
export function storeBackend(): StoreBackend | null {
  if (env('SERVER_STORE') === 'supabase') return supabaseConfig() ? 'supabase' : null;
  if (redisConfigured()) return 'redis';
  if (supabaseConfig()) return 'supabase';
  return null;
}

export function isStoreConfigured(): boolean {
  return storeBackend() !== null;
}

/**
 * True in a production runtime. import.meta.env.PROD for Astro builds; NODE_ENV for
 * anything else (tests stub NODE_ENV to exercise production-only fail-closed paths).
 */
export function isProdRuntime(): boolean {
  return !!(import.meta as any)?.env?.PROD || process.env.NODE_ENV === 'production';
}

/**
 * One structured log line per store failure so a dead backend shows up in Vercel logs
 * ("which features are running unprotected, and why") instead of vanishing in a catch {}.
 */
export function logStoreError(op: string, err: unknown): void {
  console.error(
    JSON.stringify({
      event: 'store-error',
      op,
      backend: storeBackend(),
      message: err instanceof Error ? err.message : String(err),
    })
  );
}

const unavailableWarned = new Set<string>();

/** Call from a fail-open branch when no backend is configured; warns once per op per instance. */
export function noteStoreUnavailable(op: string): void {
  if (import.meta.env?.DEV || unavailableWarned.has(op)) return;
  unavailableWarned.add(op);
  console.error(JSON.stringify({ event: 'store-unconfigured', op }));
}

// ---------------------------------------------------------------------------
// Supabase (PostgREST) backend
// ---------------------------------------------------------------------------

async function sbFetch(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Supabase store not configured');
  const res = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase store ${init.method || 'GET'} ${path.split('?')[0]}: ${res.status} ${body.slice(0, 200)}`);
  }
  return res;
}

async function sbGet<T>(key: string): Promise<T | null> {
  const res = await sbFetch(
    `/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value,expires_at&limit=1`,
    { method: 'GET' }
  );
  const rows = (await res.json()) as { value: T; expires_at: string | null }[];
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null; // expired, not yet vacuumed
  return row.value;
}

async function sbSet(key: string, value: unknown, ttlSeconds: number | null): Promise<void> {
  await sbFetch('/rest/v1/kv_store?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([
      {
        key,
        value,
        expires_at: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
    ]),
  });
}

async function sbIncr(key: string, ttlSeconds: number): Promise<number> {
  const res = await sbFetch('/rest/v1/rpc/kv_incr', {
    method: 'POST',
    body: JSON.stringify({ k: key, ttl_seconds: ttlSeconds }),
  });
  return Number(await res.json());
}

async function sbDecr(key: string): Promise<number> {
  const res = await sbFetch('/rest/v1/rpc/kv_decr', {
    method: 'POST',
    body: JSON.stringify({ k: key }),
  });
  return Number(await res.json());
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

/** Get a JSON value. Returns null when missing or expired. Throws on backend failure. */
export async function storeGet<T>(key: string): Promise<T | null> {
  const backend = storeBackend();
  if (backend === 'redis') {
    const { kv } = await import('@vercel/kv');
    return await kv.get<T>(key);
  }
  if (backend === 'supabase') return sbGet<T>(key);
  throw new Error('No server store configured');
}

/** Set a JSON value with a TTL in seconds. Throws on backend failure. */
export async function storeSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const backend = storeBackend();
  if (backend === 'redis') {
    const { kv } = await import('@vercel/kv');
    await kv.set(key, value, { ex: ttlSeconds });
    return;
  }
  if (backend === 'supabase') return sbSet(key, value, ttlSeconds);
  throw new Error('No server store configured');
}

/**
 * Atomically increment a counter, starting its TTL window on first increment
 * (and restarting it when a previous window has expired). Returns the new count.
 * Throws on backend failure.
 */
export async function storeIncr(key: string, ttlSeconds: number): Promise<number> {
  const backend = storeBackend();
  if (backend === 'redis') {
    const { kv } = await import('@vercel/kv');
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, ttlSeconds);
    return n;
  }
  if (backend === 'supabase') return sbIncr(key, ttlSeconds);
  throw new Error('No server store configured');
}

/**
 * Atomically decrement a counter (floor 0 on the supabase backend; missing keys stay
 * missing). Used to refund a reserved quota slot when the metered call never happened.
 * Throws on backend failure.
 */
export async function storeDecr(key: string): Promise<number> {
  const backend = storeBackend();
  if (backend === 'redis') {
    const { kv } = await import('@vercel/kv');
    return await kv.decr(key);
  }
  if (backend === 'supabase') return sbDecr(key);
  throw new Error('No server store configured');
}
