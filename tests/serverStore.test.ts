// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storeBackend, isStoreConfigured, storeGet, storeSet, storeIncr } from '../src/lib/serverStore';

const SB_URL = 'https://example-project.supabase.co';
const SB_KEY = 'service-role-test-key';

function clearStoreEnv() {
  for (const name of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'SUPABASE_URL', 'PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SERVER_STORE']) {
    vi.stubEnv(name, '');
  }
}

function stubSupabaseEnv() {
  vi.stubEnv('SUPABASE_URL', SB_URL);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SB_KEY);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => clearStoreEnv());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('backend selection', () => {
  it('is null (unconfigured) with no env', () => {
    expect(storeBackend()).toBeNull();
    expect(isStoreConfigured()).toBe(false);
  });
  it('prefers redis when KV vars are set', () => {
    vi.stubEnv('KV_REST_API_URL', 'https://x.upstash.io');
    vi.stubEnv('KV_REST_API_TOKEN', 't');
    stubSupabaseEnv();
    expect(storeBackend()).toBe('redis');
  });
  it('falls back to supabase when only supabase is configured', () => {
    stubSupabaseEnv();
    expect(storeBackend()).toBe('supabase');
  });
  it('accepts PUBLIC_SUPABASE_URL as the url source', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', SB_URL);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SB_KEY);
    expect(storeBackend()).toBe('supabase');
  });
  it('SERVER_STORE=supabase overrides redis (stale KV vars can stay in Vercel)', () => {
    vi.stubEnv('KV_REST_API_URL', 'https://dead.upstash.io');
    vi.stubEnv('KV_REST_API_TOKEN', 't');
    stubSupabaseEnv();
    vi.stubEnv('SERVER_STORE', 'supabase');
    expect(storeBackend()).toBe('supabase');
  });
  it('supabase needs the service key, not just the url', () => {
    vi.stubEnv('SUPABASE_URL', SB_URL);
    expect(storeBackend()).toBeNull();
  });
  it('operations throw when unconfigured', async () => {
    await expect(storeGet('k')).rejects.toThrow('No server store configured');
    await expect(storeSet('k', 1, 60)).rejects.toThrow('No server store configured');
    await expect(storeIncr('k', 60)).rejects.toThrow('No server store configured');
  });
});

describe('supabase backend', () => {
  beforeEach(() => stubSupabaseEnv());

  it('storeGet reads the row value with service-role auth', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([{ value: { a: 1 }, expires_at: null }]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await storeGet<{ a: number }>('share:abc')).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${SB_URL}/rest/v1/kv_store?key=eq.share%3Aabc&select=value,expires_at&limit=1`);
    expect(init.headers.apikey).toBe(SB_KEY);
    expect(init.headers.Authorization).toBe(`Bearer ${SB_KEY}`);
  });

  it('storeGet returns null for missing and for expired rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])));
    expect(await storeGet('nope')).toBeNull();
    const past = new Date(Date.now() - 1000).toISOString();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ value: 42, expires_at: past }])));
    expect(await storeGet('expired')).toBeNull();
  });

  it('storeSet upserts with a TTL-derived expiry', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([], 201));
    vi.stubGlobal('fetch', fetchMock);
    const before = Date.now();
    await storeSet('k1', { b: 2 }, 3600);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${SB_URL}/rest/v1/kv_store?on_conflict=key`);
    expect(init.method).toBe('POST');
    expect(init.headers.Prefer).toContain('resolution=merge-duplicates');
    const row = JSON.parse(init.body as string)[0];
    expect(row.key).toBe('k1');
    expect(row.value).toEqual({ b: 2 });
    const expires = Date.parse(row.expires_at);
    expect(expires).toBeGreaterThanOrEqual(before + 3600_000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 3600_000);
  });

  it('storeIncr calls the kv_incr RPC and returns the count', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(7));
    vi.stubGlobal('fetch', fetchMock);
    expect(await storeIncr('rl:m:1.2.3.4:99', 120)).toBe(7);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${SB_URL}/rest/v1/rpc/kv_incr`);
    expect(JSON.parse(init.body as string)).toEqual({ k: 'rl:m:1.2.3.4:99', ttl_seconds: 120 });
  });

  it('throws on non-2xx so callers can decide fail-open vs fail-closed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('permission denied', { status: 401 })));
    await expect(storeGet('k')).rejects.toThrow('401');
    await expect(storeSet('k', 1, 60)).rejects.toThrow('401');
    await expect(storeIncr('k', 60)).rejects.toThrow('401');
  });
});
