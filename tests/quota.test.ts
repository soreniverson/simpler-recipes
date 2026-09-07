// @vitest-environment node
/**
 * Adversarial tests for the AI quota (reserve-then-spend). These exist because the
 * last unmetered-AI bug shipped without any test asking "does this path pay?".
 * Runs against the supabase store backend with an in-memory PostgREST fake, so the
 * atomic incr/decr semantics are exercised for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reserveAiUse, refundAiUse, ANONYMOUS_EXTRACTION_LIMIT, AI_IP_DAILY_LIMIT } from '../src/utils/kv';
import { getTokenFromRequest } from '../src/utils/anonymousToken';

const SB_URL = 'https://example-project.supabase.co';

// ---- In-memory PostgREST fake (kv_incr / kv_decr / kv_store reads) ----
const rows = new Map<string, { value: number; expiresAt: number | null }>();

function fakeFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = String(url);
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.endsWith('/rest/v1/rpc/kv_incr')) {
    const { k, ttl_seconds } = JSON.parse(init!.body as string);
    const row = rows.get(k);
    const expired = row?.expiresAt != null && row.expiresAt <= Date.now();
    if (!row || expired) {
      rows.set(k, { value: 1, expiresAt: Date.now() + ttl_seconds * 1000 });
      return json(1);
    }
    row.value += 1;
    return json(row.value);
  }
  if (u.endsWith('/rest/v1/rpc/kv_decr')) {
    const { k } = JSON.parse(init!.body as string);
    const row = rows.get(k);
    if (!row || (row.expiresAt != null && row.expiresAt <= Date.now())) return json(0);
    row.value = Math.max(0, row.value - 1);
    return json(row.value);
  }
  return json([], 200);
}

function counterLike(prefix: string): number[] {
  return [...rows.entries()].filter(([k]) => k.startsWith(prefix)).map(([, r]) => r.value);
}

beforeEach(() => {
  rows.clear();
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('SERVER_STORE', '');
  vi.stubEnv('SUPABASE_URL', SB_URL);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('reserveAiUse', () => {
  it('grants exactly the anonymous limit, then refuses with truthful counters', async () => {
    for (let i = 1; i <= ANONYMOUS_EXTRACTION_LIMIT; i++) {
      const r = await reserveAiUse('token-aaaa1111', false, '9.9.9.9');
      expect(r).toMatchObject({ ok: true, current: i, remaining: ANONYMOUS_EXTRACTION_LIMIT - i });
    }
    const refused = await reserveAiUse('token-aaaa1111', false, '9.9.9.9');
    expect(refused).toMatchObject({ ok: false, reason: 'quota', current: ANONYMOUS_EXTRACTION_LIMIT });
    // The refused attempt must not leave the counters inflated (token) or charge the IP.
    expect(counterLike('uc:')).toEqual([ANONYMOUS_EXTRACTION_LIMIT]);
    expect(counterLike('aiip:')).toEqual([ANONYMOUS_EXTRACTION_LIMIT]);
  });

  it('is race-safe: N parallel reservations grant exactly limit slots', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => reserveAiUse('token-bbbb2222', false, null))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(ANONYMOUS_EXTRACTION_LIMIT);
    expect(counterLike('uc:')).toEqual([ANONYMOUS_EXTRACTION_LIMIT]);
  });

  it('cookie rotation is stopped by the per-IP daily cap', async () => {
    // Attacker presents a fresh token every request from one IP.
    let granted = 0;
    for (let i = 0; i < AI_IP_DAILY_LIMIT + 10; i++) {
      const r = await reserveAiUse(`rotated-${i}-xxxxxxxx`, false, '6.6.6.6');
      if (r.ok) granted += 1;
      else expect(r.reason).toBe('ip-quota');
    }
    expect(granted).toBe(AI_IP_DAILY_LIMIT);
  });

  it('refund gives the slot back for both token and IP', async () => {
    for (let i = 0; i < ANONYMOUS_EXTRACTION_LIMIT; i++) await reserveAiUse('token-cccc3333', false, '7.7.7.7');
    await refundAiUse('token-cccc3333', false, '7.7.7.7'); // AI call threw
    const r = await reserveAiUse('token-cccc3333', false, '7.7.7.7');
    expect(r.ok).toBe(true);
    expect(counterLike('uc:')).toEqual([ANONYMOUS_EXTRACTION_LIMIT]);
  });

  it('fails CLOSED in production when the store errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const r = await reserveAiUse('token-dddd4444', false, '1.1.1.1');
    expect(r).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('fails CLOSED in production when no store is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const r = await reserveAiUse('token-eeee5555', false, '1.1.1.1');
    expect(r).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('fails open outside production (local dev keeps working, uncounted)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const r = await reserveAiUse('token-ffff6666', false, '1.1.1.1');
    expect(r.ok).toBe(true);
  });
});

describe('getTokenFromRequest', () => {
  const req = (cookie?: string) => new Request('https://x.test/', { headers: cookie ? { cookie } : {} });

  it('accepts a normal UUID-shaped token', () => {
    expect(getTokenFromRequest(req('sr_token=3f2b8c1d-aaaa-4bbb-8ccc-1234567890ab'))).toBe(
      '3f2b8c1d-aaaa-4bbb-8ccc-1234567890ab'
    );
  });

  it('rejects junk so arbitrary cookie bytes never become store keys', () => {
    expect(getTokenFromRequest(req('sr_token=' + 'A'.repeat(200)))).toBeNull(); // oversized
    expect(getTokenFromRequest(req('sr_token=short'))).toBeNull(); // too short
    expect(getTokenFromRequest(req('sr_token=has%20junk%3A%2F%2F'))).toBeNull(); // bad charset
    expect(getTokenFromRequest(req())).toBeNull();
  });
});
