/**
 * URL display/safety helpers used on both server and client. No dependencies.
 */

/** Only allow http(s) hrefs when rendering user/remote-supplied URLs. Anything else → null. */
export function safeHref(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Hostname for display ("www." stripped); never throws. */
export function hostnameOf(url: unknown): string | null {
  const s = safeHref(url);
  if (!s) return null;
  try {
    return new URL(s).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
