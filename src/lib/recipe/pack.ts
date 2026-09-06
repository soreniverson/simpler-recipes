/**
 * Self-contained share links: the recipe travels IN the URL instead of in a server-side store.
 *
 * Why: short links (`/r/:id`) depend on a KV store that can disappear (and did). A packed link
 * (`/shared?d=<payload>`) needs no storage, never expires, and still renders server-side so the
 * page gets a real title and OG tags. The client tries the short link first and falls back to this.
 *
 * Format: "<version>~<base64url(deflate-raw(JSON))>".
 *   v1 payload: { r: Recipe, s?: sourceUrl }
 * Uses the web-standard CompressionStream API, available in modern browsers and Node 18+.
 * Everything decoded here is untrusted input — callers MUST run the result through validateRecipe
 * (unpackRecipe does this itself).
 */
import { validateRecipe, safeHref, MAX_SHARE_BYTES } from './validate';
import type { Recipe } from './types';

const VERSION = '1';

/** Packed payloads can't exceed the same budget as stored shares. */
export const MAX_PACKED_CHARS = 24000;

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const src = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  const buf = await new Response(src).arrayBuffer();
  return new Uint8Array(buf);
}

/** Recipe (+ optional source URL) → URL-safe payload string. */
export async function packRecipe(recipe: Recipe, sourceUrl?: string | null): Promise<string> {
  const json = JSON.stringify({ r: recipe, ...(sourceUrl ? { s: sourceUrl } : {}) });
  const deflated = await pipeThrough(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  const payload = `${VERSION}~${b64url(deflated)}`;
  if (payload.length > MAX_PACKED_CHARS) throw new Error('recipe too large to pack into a link');
  return payload;
}

export type UnpackResult = { ok: true; recipe: Recipe; sourceUrl: string | null } | { ok: false };

/** Payload string → validated recipe. Never throws; anything malformed is { ok: false }. */
export async function unpackRecipe(payload: unknown): Promise<UnpackResult> {
  try {
    if (typeof payload !== 'string' || payload.length > MAX_PACKED_CHARS) return { ok: false };
    const sep = payload.indexOf('~');
    if (sep < 1 || payload.slice(0, sep) !== VERSION) return { ok: false };
    const body = payload.slice(sep + 1);
    if (!/^[A-Za-z0-9_-]+$/.test(body)) return { ok: false };

    const inflated = await pipeThrough(fromB64url(body), new DecompressionStream('deflate-raw'));
    if (inflated.length > MAX_SHARE_BYTES) return { ok: false };
    const parsed = JSON.parse(new TextDecoder().decode(inflated));
    if (!parsed || typeof parsed !== 'object' || !parsed.r) return { ok: false };

    const v = validateRecipe(parsed.r);
    if (!v.ok) return { ok: false };
    return { ok: true, recipe: v.recipe, sourceUrl: safeHref(parsed.s ?? v.recipe.sourceUrl) ?? null };
  } catch {
    return { ok: false };
  }
}

/** Short stable fingerprint of a payload — used as the cook-state id for packed pages. */
export function packedId(payload: string): string {
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
