/**
 * Tiny GA4 event helper. Pushes through the dataLayer the BaseLayout snippet creates,
 * so events queue correctly whether gtag.js has loaded yet or is blocked entirely
 * (blocked = the queue is simply never read; nothing breaks, nothing is sent).
 *
 * Privacy rules for callers: never pass pasted URLs, recipe text, tokens, or anything
 * a person typed. Route pathnames, catalog slugs, and server error codes only.
 */
export function track(event, params = {}) {
  try {
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    gtag('event', event, params);
  } catch {
    /* analytics must never break the product */
  }
}

/** The current route for event context — our own pathname, never query strings. */
export function surface() {
  try {
    return window.location.pathname;
  } catch {
    return '';
  }
}
