/**
 * Anonymous token management for tracking usage before signup.
 *
 * Tokens are stored in localStorage and sent via cookie for server-side tracking.
 * This allows rate limiting extractions without requiring an account.
 */

const TOKEN_KEY = 'simpler-recipes-token';
const COOKIE_NAME = 'sr_token';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create anonymous token (client-side)
 */
export function getAnonymousToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    token = generateUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }

  // Also set as cookie so server can read it
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;

  return token;
}

/**
 * Get token from request cookies (server-side).
 *
 * The token is client-supplied and unauthenticated, so it is UX state, not a security
 * boundary — quota enforcement against hostile clients is the per-IP cap in
 * `reserveAiUse`. Constrain the format anyway so arbitrary cookie junk never becomes
 * a store key (size, charset).
 */
export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies[COOKIE_NAME] || null;
  if (!token || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  return token;
}

/**
 * Check if user has a token (client-side)
 */
export function hasAnonymousToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(TOKEN_KEY);
}
