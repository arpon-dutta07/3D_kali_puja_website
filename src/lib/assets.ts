import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture, TextureLoader, type CanvasTexture } from 'three';

const loader = new TextureLoader();
const cache = new Map<string, Promise<Texture | null>>();

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}

/**
 * Loads `public/assets/<path>`. Resolves to null when the file isn't there yet, so every scene can fall back to its
 * placeholder and the real art drops in later without a code change.
 */
export function loadTexture(path: string): Promise<Texture | null> {
  let p = cache.get(path);
  if (!p) {
    p = new Promise((resolve) => {
      loader.load(
        assetUrl(path),
        (tex) => {
          tex.colorSpace = SRGBColorSpace;
          tex.minFilter = LinearMipmapLinearFilter;
          tex.magFilter = LinearFilter;
          tex.anisotropy = 4;
          resolve(tex);
        },
        undefined,
        () => resolve(null),
      );
    });
    cache.set(path, p);
  }
  return p;
}

/** The real art when it exists, otherwise the placeholder made by `make`. */
export async function artOr(path: string, make: () => CanvasTexture): Promise<{ tex: Texture; real: boolean }> {
  const tex = await loadTexture(path);
  if (tex) return { tex, real: true };
  const ph = make();
  ph.colorSpace = SRGBColorSpace;
  return { tex: ph, real: false };
}

/** Numbered sprites cut from one sheet (jaba-1.webp, jaba-2.webp ...). Stops at the first missing number. */
export async function loadSeries(base: string, max: number): Promise<Texture[]> {
  const out: Texture[] = [];
  for (let i = 1; i <= max; i++) {
    const t = await loadTexture(`${base}-${i}.webp`);
    if (!t) break;
    out.push(t);
  }
  return out;
}

export function aspectOf(tex: Texture): number {
  const img = tex.image as { width?: number; height?: number } | undefined;
  return img?.width && img.height ? img.width / img.height : 1;
}
