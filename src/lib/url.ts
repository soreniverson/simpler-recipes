/**
 * URL normalization and validation for recipe extraction.
 *
 * Goals:
 *  - Accept what people actually paste ("allrecipes.com/recipe/…", " https://x ", with utm junk).
 *  - Canonicalize so the same page submitted through slightly different URLs hits the same cache key.
 *  - Never remove parameters that might identify the recipe (only known tracking params go).
 */

/** Tracking / analytics params that never affect page content. */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'twclid', 'ttclid',
  'igshid', 'igsh', 'mc_cid', 'mc_eid', 'mkt_tok', '_hsenc', '_hsmi', 'hsCtaTracking',
  'vero_id', 'yclid', '_ga', '_gl', 'ref', 'ref_src', 'ref_url', 'referrer', 'source',
  'share', 'sharesource', 'si', 'feature', 'cmpid', 'cid', 'ncid', 'sr_share',
  'epik', 'pp', 'oly_anon_id', 'oly_enc_id', 'rb_clickid', 's_cid', 'trk', 'trkCampaign',
  'ss_source', 'ss_campaign_id', 'ss_email_id',
]);

/** Param name prefixes that are always tracking. */
const TRACKING_PREFIXES = ['utm_', 'pk_', 'piwik_', 'mtm_', 'hsa_', 'sc_', 'ga_'];

/** Params whose value marks an AMP variant of the same page. */
const AMP_PARAMS = new Set(['amp', 'amp_js_v', 'amp_gsa', 'usqp', 'outputType']);

export type NormalizeResult =
  | { ok: true; url: string; original: string }
  | { ok: false; error: 'empty' | 'invalid' | 'unsupported-scheme' | 'invalid-host' };

/**
 * Turn user input into a canonical http(s) URL string.
 * Returns ok:false with a reason instead of throwing.
 */
export function normalizeUrl(input: unknown): NormalizeResult {
  if (typeof input !== 'string') return { ok: false, error: 'invalid' };
  let raw = input.trim();
  if (!raw) return { ok: false, error: 'empty' };

  // People paste with surrounding punctuation or angle brackets from chats/emails.
  // Loop: '"https://x".' has punctuation after the quote and a quote after that.
  for (let i = 0; i < 3; i++) {
    raw = raw.replace(/^[<("'\[]+/, '').replace(/[>)"'\]]+$/, '').replace(/[.,;:!]+$/, '');
  }
  // Strip stray whitespace inside (line-wrapped URLs from emails).
  raw = raw.replace(/\s+/g, '');
  if (!raw) return { ok: false, error: 'empty' };

  // Explicit non-http scheme → unsupported.
  const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  // "example.com:8080/x" — a dotted host followed by a port is not a scheme.
  const hostPort = schemeMatch && /^[a-z0-9-]+(\.[a-z0-9-]+)+:\d{1,5}(\/|$)/i.test(raw);
  if (schemeMatch && !hostPort) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return { ok: false, error: 'unsupported-scheme' };
  } else {
    // "www.site.com/x" or "site.com/x" or "//site.com/x"
    raw = 'https://' + raw.replace(/^\/\//, '');
  }

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: 'invalid' };
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'unsupported-scheme' };
  if (!u.hostname || !u.hostname.includes('.') && u.hostname !== 'localhost') {
    // Bare words like "chicken" are not URLs. (localhost is handled by SSRF checks, not here.)
    return { ok: false, error: 'invalid-host' };
  }
  if (u.username || u.password) return { ok: false, error: 'invalid' };

  u.hostname = u.hostname.toLowerCase();
  u.hash = '';

  // Drop tracking + AMP params, keep everything else in original order.
  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams.entries()) {
    const key = k.toLowerCase();
    if (TRACKING_PARAMS.has(key)) continue;
    if (TRACKING_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (AMP_PARAMS.has(key)) continue;
    kept.push([k, v]);
  }
  u.search = '';
  for (const [k, v] of kept) u.searchParams.append(k, v);

  // AMP path variants → canonical path.
  let path = u.pathname;
  path = path.replace(/\/amp\/?$/i, '/').replace(/\/amp\/(?=.)/i, '/');
  path = path.replace(/^\/amp\//i, '/');
  // Collapse duplicate slashes.
  path = path.replace(/\/{2,}/g, '/');
  u.pathname = path || '/';

  // Mobile subdomain → www is site-specific; only handle the well-known "m." case for
  // hosts where it's known-safe. Leave others alone rather than guess.
  if (/^m\.(allrecipes|foodnetwork|bbcgoodfood|epicurious|delish|tasteofhome)\.com$/.test(u.hostname)) {
    u.hostname = 'www.' + u.hostname.slice(2);
  }

  // Default ports.
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';

  return { ok: true, url: u.toString(), original: input.trim() };
}

/**
 * Stable cache key for a URL. Same page ⇒ same key regardless of trailing slash,
 * scheme, "www.", param order, or tracking params.
 */
export function cacheKeyForUrl(url: string): string {
  const n = normalizeUrl(url);
  const s = n.ok ? n.url : url;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return s.toLowerCase();
  }
  const host = u.hostname.replace(/^www\./, '');
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const search = params.length ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&') : '';
  const path = u.pathname.replace(/\/+$/, '') || '/';
  return `${host}${path}${search}`;
}

/** Cheap heuristic: does this text look like a URL (vs. a search query)? */
export function looksLikeUrl(input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^www\./i.test(t)) return true;
  // domain.tld or domain.tld/path — but not "chicken. thighs" style prose
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$|\?)/i.test(t) && !/\s/.test(t);
}
