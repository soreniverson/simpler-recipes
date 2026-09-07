import type { APIRoute } from 'astro';
import { storeBackend, storeSet, storeGet } from '../../lib/serverStore';

export const prerender = false;

/**
 * Operational health for the probe workflow (.github/workflows/health-probe.yml).
 * 200 when the store round-trips and the AI key is present; 503 otherwise, with
 * enough detail to know which layer broke. No secrets, no user data.
 *
 * The store probe is cached in-instance for 30s so a public endpoint can't be
 * hammered into burning the store's command quota (each probe is 2 commands).
 */

type StoreStatus = 'ok' | 'unconfigured' | 'error';

let lastProbe: { at: number; status: StoreStatus } | null = null;
const PROBE_CACHE_MS = 30_000;

async function probeStore(): Promise<StoreStatus> {
  if (!storeBackend()) return 'unconfigured';
  if (lastProbe && Date.now() - lastProbe.at < PROBE_CACHE_MS) return lastProbe.status;
  let status: StoreStatus;
  try {
    const stamp = Date.now();
    await storeSet('health:probe', stamp, 120);
    const back = await storeGet<number>('health:probe');
    status = back === stamp ? 'ok' : 'error';
  } catch {
    status = 'error';
  }
  lastProbe = { at: Date.now(), status };
  return status;
}

export const GET: APIRoute = async () => {
  const started = Date.now();
  const store = await probeStore();
  const ai = !!(import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
  const ok = store === 'ok' && ai;
  return new Response(
    JSON.stringify({ ok, store, backend: storeBackend(), ai, ms: Date.now() - started }),
    {
      status: ok ? 200 : 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
};
