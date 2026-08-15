/**
 * Build-time image optimization for the curated catalog.
 *
 * Collection cards and recipe heroes were hotlinking 100–300KB originals from eight publishers
 * (2.6MB per collection page, third-party cookies, hotlink fragility). At build we fetch each
 * image once, resize to what the layout needs, and serve WebP from our own origin.
 *
 * Astro's remote loader runs at the END of the build and throws on redirects/non-images (which
 * would fail the whole build), so we pre-flight every URL here: follow redirects ourselves,
 * confirm it's an image, and hand Astro only the final verified URL. Anything else falls back
 * to the original remote URL. Set SKIP_IMAGE_OPT=1 to bypass entirely.
 */
import { getImage } from 'astro:assets';

export interface OptimizedImage {
  src: string;
  width: number;
  height: number;
  /** true when we fell back to the remote original */
  remote: boolean;
}

const resolved = new Map<string, Promise<string | null>>();
const outputs = new Map<string, Promise<OptimizedImage>>();

/** Follow redirects and verify the resource is an image. Returns the final URL or null. */
function preflight(url: string): Promise<string | null> {
  if (!resolved.has(url)) {
    resolved.set(
      url,
      (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 8000);
          const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: ctrl.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: 'image/*,*/*;q=0.5' },
          });
          clearTimeout(t);
          // Drain minimally; we only need headers.
          try { await res.body?.cancel(); } catch { /* ignore */ }
          if (!res.ok) return null;
          const type = res.headers.get('content-type') || '';
          if (!/^image\//i.test(type)) return null;
          const finalUrl = res.url || url;
          // Astro re-fetches with redirect:'error' — only pass URLs that now resolve directly.
          return finalUrl;
        } catch {
          return null;
        }
      })()
    );
  }
  return resolved.get(url)!;
}

export function optimizeRemote(url: string | null | undefined, width: number, height: number, quality = 72): Promise<OptimizedImage | null> {
  if (!url || !/^https?:\/\//.test(url)) return Promise.resolve(null);
  const key = `${url}|${width}x${height}|${quality}`;
  if (!outputs.has(key)) {
    outputs.set(
      key,
      (async () => {
        const fallback: OptimizedImage = { src: url, width, height, remote: true };
        if (process.env.SKIP_IMAGE_OPT) return fallback;
        const finalUrl = await preflight(url);
        if (!finalUrl) return fallback;
        try {
          const img = await getImage({ src: finalUrl, width, height, format: 'webp', quality, fit: 'cover' });
          return { src: img.src, width, height, remote: false };
        } catch {
          return fallback;
        }
      })()
    );
  }
  return outputs.get(key)!;
}

/** Card image at two widths (phones fetch ~half the bytes). Returns null when the original is missing. */
export async function cardImage(url: string | null | undefined): Promise<{ src: string; set: string | null } | null> {
  if (!url) return null;
  const [w320, w400, w480] = await Promise.all([optimizeRemote(url, 320, 240), optimizeRemote(url, 400, 300), optimizeRemote(url, 480, 360)]);
  if (!w480) return null;
  const all = [w320, w400, w480];
  const set = all.every((x) => x && !x.remote) ? `${w320!.src} 320w, ${w400!.src} 400w, ${w480.src} 480w` : null;
  return { src: w480.src, set };
}
