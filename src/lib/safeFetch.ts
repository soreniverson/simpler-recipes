/**
 * SSRF-hardened fetch for user-supplied URLs.
 *
 * The extractor fetches arbitrary URLs from a serverless function. Without guards, a request
 * for http://169.254.169.254/… or http://localhost:… would be executed with the function's
 * network position. This module:
 *
 *  - only allows http(s)
 *  - resolves the hostname and rejects loopback / private / link-local / multicast /
 *    unique-local / unspecified / IPv4-mapped addresses (and the cloud metadata IP)
 *  - follows redirects MANUALLY so every hop is re-validated (max 5)
 *  - enforces a total timeout and a maximum body size (streamed, aborted on overflow)
 *  - only accepts HTML/XML/text bodies
 *  - sends a realistic browser UA (many recipe sites 403 unknown bots)
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const DEFAULT_TIMEOUT_MS = 12_000;
export const DEFAULT_MAX_BYTES = 3 * 1024 * 1024; // 3MB of HTML is plenty for any recipe page
export const MAX_REDIRECTS = 5;

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SimplerRecipes/1.0 (+https://simpler.recipes)';

export type SafeFetchErrorCode =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'blocked-host'
  | 'dns-failed'
  | 'timeout'
  | 'too-many-redirects'
  | 'too-large'
  | 'unsupported-content-type'
  | 'http-error'
  | 'network-error';

export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  status?: number;
  constructor(code: SafeFetchErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
    this.status = status;
  }
}

export interface SafeFetchResult {
  /** Final URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  body: string;
  redirected: boolean;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Test hook: override DNS resolution. */
  resolve?: (hostname: string) => Promise<string[]>;
  /** Test hook: override fetch. */
  fetchImpl?: typeof fetch;
}

// ---------- IP classification ----------

function ipv4ToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function inCidr4(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(range) & mask) >>> 0);
}

const BLOCKED_V4 = [
  '0.0.0.0/8', // "this" network
  '10.0.0.0/8', // private
  '100.64.0.0/10', // carrier-grade NAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local (incl. 169.254.169.254 metadata)
  '172.16.0.0/12', // private
  '192.0.0.0/24', // IETF protocol assignments
  '192.0.2.0/24', // TEST-NET-1
  '192.88.99.0/24', // 6to4 relay (deprecated)
  '192.168.0.0/16', // private
  '198.18.0.0/15', // benchmarking
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved + broadcast
];

/** Expand an IPv6 string into 8 16-bit groups. Returns null if unparseable. */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  // Strip zone id
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  // Embedded IPv4 tail (::ffff:1.2.3.4)
  const v4tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const n = ipv4ToInt(v4tail[1]);
    s = s.slice(0, -v4tail[1].length) + ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16);
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (parts.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(missing).fill('0'), ...tail].map((g) => parseInt(g || '0', 16));
  if (groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

function isBlockedV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true; // unparseable → block
  const allZero = g.every((x) => x === 0);
  if (allZero) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  // IPv4-mapped ::ffff:a.b.c.d  → check the v4
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedV4(v4);
  }
  // IPv4-compatible ::a.b.c.d (deprecated) → check v4
  if (g.slice(0, 6).every((x) => x === 0) && (g[6] !== 0 || g[7] > 1)) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedV4(v4);
  }
  // NAT64 64:ff9b::/96 → embedded v4
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    return isBlockedV4(v4);
  }
  const first = g[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  if (first === 0x2002) {
    // 6to4 2002:AABB:CCDD:: → embedded v4
    const v4 = `${g[1] >> 8}.${g[1] & 0xff}.${g[2] >> 8}.${g[2] & 0xff}`;
    return isBlockedV4(v4);
  }
  return false;
}

export function isBlockedV4(ip: string): boolean {
  return BLOCKED_V4.some((c) => inCidr4(ip, c));
}

/** True if this literal IP address must never be fetched. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind === 6) return isBlockedV6(ip);
  return true;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata', 'metadata.google.internal', 'instance-data', 'ip6-localhost', 'ip6-loopback']);

/** True if the hostname itself is obviously internal (before DNS). */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.arpa')) return true;
  if (!h.includes('.')) return true; // single-label names are intranet names
  // Decimal / hex / octal IPv4 obfuscations ("2130706433", "0x7f000001", "0177.0.0.1")
  if (/^\d+$/.test(h)) return true;
  if (/^0x[0-9a-f]+$/i.test(h)) return true;
  if (/^0\d/.test(h) && /^[0-7.]+$/.test(h)) return true;
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){1,3}$/i.test(h) && isIP(h) !== 4) return true;
  return false;
}

async function defaultResolve(hostname: string): Promise<string[]> {
  try {
    const results = await lookup(hostname, { all: true, verbatim: true });
    return results.map((r) => r.address);
  } catch (err: any) {
    // Transient resolver hiccups (EAI_AGAIN/ETIMEOUT) are common under parallel load; retry once.
    if (err && (err.code === 'EAI_AGAIN' || err.code === 'ETIMEOUT' || err.code === 'ECONNREFUSED')) {
      await new Promise((r) => setTimeout(r, 150));
      const results = await lookup(hostname, { all: true, verbatim: true });
      return results.map((r) => r.address);
    }
    throw err;
  }
}

/**
 * Validate a URL for outbound fetching. Throws SafeFetchError.
 * Returns the parsed URL and the resolved addresses.
 */
export async function assertSafeUrl(
  input: string,
  resolve: (hostname: string) => Promise<string[]> = defaultResolve
): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError('invalid-url', 'Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('unsupported-scheme', 'Only http and https URLs are supported');
  }
  if (url.username || url.password) throw new SafeFetchError('invalid-url', 'Credentials in URL are not allowed');

  let host = url.hostname;
  // URL keeps IPv6 literals in brackets
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);

  if (isBlockedHostname(host)) throw new SafeFetchError('blocked-host', 'That address is not allowed');

  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError('blocked-host', 'That address is not allowed');
    return { url, addresses: [host] };
  }

  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new SafeFetchError('dns-failed', 'Could not find that site');
  }
  if (!addresses.length) throw new SafeFetchError('dns-failed', 'Could not find that site');
  for (const a of addresses) {
    if (isBlockedIp(a)) throw new SafeFetchError('blocked-host', 'That address is not allowed');
  }
  return { url, addresses };
}

const OK_CONTENT_TYPES = /^(text\/(html|plain|xml)|application\/(xhtml\+xml|xml|json|ld\+json|rss\+xml|atom\+xml))/i;

/**
 * Fetch a user-supplied URL safely and return its text body.
 * Throws SafeFetchError for anything that isn't a 2xx text-ish response.
 */
export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  const resolve = opts.resolve ?? defaultResolve;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    let current = input;
    let redirected = false;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      const { url } = await assertSafeUrl(current, resolve);

      let res: Response;
      try {
        res = await fetchImpl(url.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            ...opts.headers,
          },
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') throw new SafeFetchError('timeout', 'That site took too long to respond');
        throw new SafeFetchError('network-error', 'Could not reach that site');
      }

      // Redirect: validate the next hop ourselves.
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        // Drain/cancel the body so the connection can be reused.
        try { await res.body?.cancel(); } catch { /* ignore */ }
        if (!loc) throw new SafeFetchError('http-error', `Redirect without location (${res.status})`, res.status);
        let next: URL;
        try {
          next = new URL(loc, url);
        } catch {
          throw new SafeFetchError('invalid-url', 'Bad redirect target');
        }
        if (next.protocol !== 'http:' && next.protocol !== 'https:') {
          throw new SafeFetchError('unsupported-scheme', 'Redirected to an unsupported URL');
        }
        current = next.toString();
        redirected = true;
        if (hop === maxRedirects) throw new SafeFetchError('too-many-redirects', 'Too many redirects');
        continue;
      }

      if (!res.ok) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        throw new SafeFetchError('http-error', `HTTP ${res.status}`, res.status);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType && !OK_CONTENT_TYPES.test(contentType)) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        throw new SafeFetchError('unsupported-content-type', `Not a web page (${contentType.split(';')[0]})`);
      }
      const declared = Number(res.headers.get('content-length') || 0);
      if (declared > maxBytes) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        throw new SafeFetchError('too-large', 'That page is too large');
      }

      // Stream with a hard cap.
      const body = await readBodyCapped(res, maxBytes, controller);
      return { url: url.toString(), status: res.status, contentType, body, redirected };
    }
    throw new SafeFetchError('too-many-redirects', 'Too many redirects');
  } catch (err: any) {
    if (err instanceof SafeFetchError) throw err;
    if (err?.name === 'AbortError' || Date.now() - started >= timeoutMs) {
      throw new SafeFetchError('timeout', 'That site took too long to respond');
    }
    throw new SafeFetchError('network-error', 'Could not reach that site');
  } finally {
    clearTimeout(timer);
  }
}

async function readBodyCapped(res: Response, maxBytes: number, controller: AbortController): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        controller.abort();
        throw new SafeFetchError('too-large', 'That page is too large');
      }
      chunks.push(value);
    }
  }
  const all = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  // Recipe sites are overwhelmingly UTF-8; honor a declared charset when it isn't.
  const ct = res.headers.get('content-type') || '';
  const m = ct.match(/charset=([^;]+)/i);
  const charset = m ? m[1].trim().replace(/^["']|["']$/g, '').toLowerCase() : 'utf-8';
  try {
    return new TextDecoder(charset === 'utf8' ? 'utf-8' : charset).decode(all);
  } catch {
    return new TextDecoder('utf-8').decode(all);
  }
}
