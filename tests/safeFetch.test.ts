import { describe, it, expect } from 'vitest';
import {
  isBlockedIp,
  isBlockedHostname,
  assertSafeUrl,
  safeFetch,
  SafeFetchError,
} from '../src/lib/safeFetch';

const publicResolve = async () => ['93.184.216.34'];

describe('isBlockedIp', () => {
  it('blocks loopback, private, link-local, metadata', () => {
    for (const ip of [
      '127.0.0.1', '127.1.2.3', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '169.254.169.254', '169.254.0.1', '0.0.0.0', '0.1.2.3', '100.64.0.1',
      '224.0.0.1', '255.255.255.255', '240.0.0.1', '192.0.0.1', '198.18.0.1',
      '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
      '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:169.254.169.254', '::ffff:7f00:1',
      '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1', 'fec0::1',
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it('allows public addresses', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.255.255', '11.0.0.1', '2606:4700:4700::1111', '2a00:1450:4001:80e::200e', '::ffff:8.8.8.8']) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
  it('blocks garbage', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
    expect(isBlockedIp('')).toBe(true);
  });
});

describe('isBlockedHostname', () => {
  it('blocks internal names and numeric obfuscations', () => {
    for (const h of ['localhost', 'LOCALHOST', 'localhost.', 'foo.localhost', 'metadata.google.internal', 'metadata', 'my-service', 'db.internal', 'printer.local', '2130706433', '0x7f000001', '0177.0.0.1', '0x7f.0.0.1', '1.in-addr.arpa']) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });
  it('allows normal domains', () => {
    for (const h of ['www.allrecipes.com', 'example.com', 'sub.domain.co.uk', 'xn--80ak6aa92e.com', '1password.com']) {
      expect(isBlockedHostname(h), h).toBe(false);
    }
  });
});

describe('assertSafeUrl', () => {
  it('rejects non-http schemes', async () => {
    await expect(assertSafeUrl('file:///etc/passwd', publicResolve)).rejects.toMatchObject({ code: 'unsupported-scheme' });
    await expect(assertSafeUrl('ftp://example.com/', publicResolve)).rejects.toMatchObject({ code: 'unsupported-scheme' });
    await expect(assertSafeUrl('gopher://example.com/', publicResolve)).rejects.toMatchObject({ code: 'unsupported-scheme' });
  });
  it('rejects literal internal IPs and bracketed IPv6', async () => {
    await expect(assertSafeUrl('http://127.0.0.1:4321/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    await expect(assertSafeUrl('http://[::1]:4321/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    await expect(assertSafeUrl('http://[::ffff:127.0.0.1]/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    await expect(assertSafeUrl('http://0x7f000001/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    await expect(assertSafeUrl('http://2130706433/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    await expect(assertSafeUrl('http://localhost:4321/', publicResolve)).rejects.toMatchObject({ code: 'blocked-host' });
  });
  it('rejects hostnames that resolve to internal IPs (DNS rebinding)', async () => {
    const evilResolve = async () => ['93.184.216.34', '10.0.0.5'];
    await expect(assertSafeUrl('https://evil.example.com/', evilResolve)).rejects.toMatchObject({ code: 'blocked-host' });
    const loopbackResolve = async () => ['127.0.0.1'];
    await expect(assertSafeUrl('https://rebind.example.com/', loopbackResolve)).rejects.toMatchObject({ code: 'blocked-host' });
  });
  it('rejects credentials', async () => {
    await expect(assertSafeUrl('https://a:b@example.com/', publicResolve)).rejects.toMatchObject({ code: 'invalid-url' });
  });
  it('reports dns failures', async () => {
    const failing = async () => { throw new Error('ENOTFOUND'); };
    await expect(assertSafeUrl('https://nope.invalid/', failing)).rejects.toMatchObject({ code: 'dns-failed' });
  });
  it('allows public hosts', async () => {
    const r = await assertSafeUrl('https://www.allrecipes.com/recipe/1/', publicResolve);
    expect(r.addresses).toEqual(['93.184.216.34']);
  });
});

function mockFetch(routes: Record<string, () => Response>): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const handler = routes[url];
    if (!handler) return new Response('nope', { status: 404 });
    return handler();
  }) as typeof fetch;
}

describe('safeFetch', () => {
  it('returns html body', async () => {
    const fetchImpl = mockFetch({
      'https://example.com/r': () => new Response('<html>hi</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    });
    const r = await safeFetch('https://example.com/r', { fetchImpl, resolve: publicResolve });
    expect(r.body).toBe('<html>hi</html>');
    expect(r.redirected).toBe(false);
    expect(r.url).toBe('https://example.com/r');
  });

  it('follows redirects and re-validates each hop', async () => {
    const fetchImpl = mockFetch({
      'http://example.com/a': () => new Response(null, { status: 301, headers: { location: '/b' } }),
      'http://example.com/b': () => new Response(null, { status: 302, headers: { location: 'https://www.example.com/c' } }),
      'https://www.example.com/c': () => new Response('<html>final</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    });
    const r = await safeFetch('http://example.com/a', { fetchImpl, resolve: publicResolve });
    expect(r.body).toBe('<html>final</html>');
    expect(r.url).toBe('https://www.example.com/c');
    expect(r.redirected).toBe(true);
  });

  it('blocks a redirect to an internal address', async () => {
    const fetchImpl = mockFetch({
      'https://example.com/a': () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } }),
    });
    await expect(safeFetch('https://example.com/a', { fetchImpl, resolve: publicResolve })).rejects.toMatchObject({ code: 'blocked-host' });
  });

  it('blocks a redirect to a hostname resolving internally', async () => {
    const fetchImpl = mockFetch({
      'https://example.com/a': () => new Response(null, { status: 302, headers: { location: 'https://internal.example.com/' } }),
    });
    const resolve = async (h: string) => (h === 'internal.example.com' ? ['10.1.1.1'] : ['93.184.216.34']);
    await expect(safeFetch('https://example.com/a', { fetchImpl, resolve })).rejects.toMatchObject({ code: 'blocked-host' });
  });

  it('gives up after too many redirects', async () => {
    const routes: Record<string, () => Response> = {};
    for (let i = 0; i < 10; i++) {
      routes[`https://example.com/${i}`] = () => new Response(null, { status: 302, headers: { location: `/${i + 1}` } });
    }
    await expect(safeFetch('https://example.com/0', { fetchImpl: mockFetch(routes), resolve: publicResolve })).rejects.toMatchObject({ code: 'too-many-redirects' });
  });

  it('rejects non-html content types', async () => {
    const fetchImpl = mockFetch({
      'https://example.com/x.pdf': () => new Response('%PDF', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    });
    await expect(safeFetch('https://example.com/x.pdf', { fetchImpl, resolve: publicResolve })).rejects.toMatchObject({ code: 'unsupported-content-type' });
  });

  it('rejects oversized bodies (declared and streamed)', async () => {
    const big = 'x'.repeat(2000);
    const fetchImpl = mockFetch({
      'https://example.com/declared': () => new Response(big, { status: 200, headers: { 'content-type': 'text/html', 'content-length': '999999' } }),
      'https://example.com/streamed': () => new Response(big, { status: 200, headers: { 'content-type': 'text/html' } }),
    });
    await expect(safeFetch('https://example.com/declared', { fetchImpl, resolve: publicResolve, maxBytes: 1000 })).rejects.toMatchObject({ code: 'too-large' });
    await expect(safeFetch('https://example.com/streamed', { fetchImpl, resolve: publicResolve, maxBytes: 1000 })).rejects.toMatchObject({ code: 'too-large' });
  });

  it('surfaces http errors with status', async () => {
    const fetchImpl = mockFetch({
      'https://example.com/404': () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }),
      'https://example.com/403': () => new Response('nope', { status: 403 }),
    });
    await expect(safeFetch('https://example.com/404', { fetchImpl, resolve: publicResolve })).rejects.toMatchObject({ code: 'http-error', status: 404 });
    await expect(safeFetch('https://example.com/403', { fetchImpl, resolve: publicResolve })).rejects.toMatchObject({ code: 'http-error', status: 403 });
  });

  it('times out', async () => {
    const fetchImpl = ((_: any, init: any) =>
      new Promise<Response>((_res, rej) => {
        init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })) as typeof fetch;
    await expect(safeFetch('https://example.com/slow', { fetchImpl, resolve: publicResolve, timeoutMs: 50 })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('decodes declared charset', async () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]); // "café" in latin1
    const fetchImpl = mockFetch({
      'https://example.com/l1': () => new Response(latin1, { status: 200, headers: { 'content-type': 'text/html; charset=ISO-8859-1' } }),
    });
    const r = await safeFetch('https://example.com/l1', { fetchImpl, resolve: publicResolve });
    expect(r.body).toBe('café');
  });

  it('is a SafeFetchError instance', async () => {
    try {
      await safeFetch('file:///x', { resolve: publicResolve });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SafeFetchError);
    }
  });
});
