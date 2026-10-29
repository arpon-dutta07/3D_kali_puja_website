import { Mesh, PlaneGeometry, type Object3D, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { Glows } from '../gl/glows';
import { litMaterial, lu } from '../gl/lit';
import type { Stage } from '../gl/stage';
import { aspectOf, loadTexture } from '../lib/assets';

interface Piece {
  mesh: Mesh;
  mat: ShaderMaterial;
  /** Lamp trees light up at midnight; the rest is lit by the lamps and the halo. */
  glow: boolean;
}

/** The Kali Puja decoration that stands beside Ma, shared by the opening and the garland's ending. */
export interface ShrineDecor {
  pieces: Piece[];
  /** The lamp trees' own light (on the stage's light map). */
  lights: Glows | null;
  /** Half-width of everything beside her, for framing. */
  side: number;
}

/**
 * Lamp trees, ghots, dhaks, jaba strands, drapes and a shola chandmala on both sides of Ma (art/ANTIGRAVITY-ROUND-2.md),
 * in `parent`'s space. Each piece appears only once its picture exists; nothing is drawn in its place.
 */
export async function buildShrineDecor(S: Stage, parent: Object3D, ma: { w: number; h: number; base: number; z: number }): Promise<ShrineDecor> {
  const [tree, drape, strands, ghot, dhak, chand] = await Promise.all(
    ['decor-lamp-tree', 'decor-drape', 'decor-jaba-strands', 'decor-ghot', 'decor-dhak', 'decor-chandmala'].map((n) => loadTexture(`intro/${n}.webp`)),
  );
  const pieces: Piece[] = [];
  const add = (tex: Texture, h: number, x: number, bottom: number, z: number, mirror: boolean, glow = false, order = 9) => {
    const w = h * aspectOf(tex);
    const mat = litMaterial(S, tex, { ambient: 0.02, gain: 0.8, emissive: 0 });
    lu(mat).uRiseColor.value.set('#ff9a50');
    const mesh = new Mesh(new PlaneGeometry(w, h), mat);
    mesh.position.set(x, bottom + h / 2, z);
    if (mirror) mesh.scale.x = -1;
    mesh.renderOrder = order;
    parent.add(mesh);
    pieces.push({ mesh, mat, glow });
    return w;
  };
  const half = ma.w / 2;
  let side = half;
  let lights: Glows | null = null;
  if (tree) {
    const h = ma.h * 0.82;
    const w = h * aspectOf(tree);
    for (const s of [-1, 1]) add(tree, h, s * (half + w / 2 + 0.2), ma.base, ma.z + 0.35, s > 0, true);
    side = half + w + 0.2;
    // Their flames light Ma and the wall at midnight.
    lights = new Glows(2, S.lightScene);
    lights.colorAll(config.palette.amber);
    const o = parent.position;
    for (const [i, s] of [-1, 1].entries()) lights.set(i, o.x + s * (half + w / 2 + 0.2), o.y + ma.base + h * 0.62, o.z + ma.z + 0.4, h * 2.4, 0);
    lights.commit();
  }
  if (ghot) {
    const h = ma.h * 0.26;
    const w = h * aspectOf(ghot);
    for (const s of [-1, 1]) add(ghot, h, s * (side + w / 2 + 0.15), ma.base, ma.z + 0.7, s > 0);
    side += w + 0.15;
  }
  if (dhak) {
    const h = ma.h * 0.36;
    const w = h * aspectOf(dhak);
    for (const s of [-1, 1]) add(dhak, h, s * (side + w / 2 + 0.25), ma.base, ma.z + 0.9, s > 0);
    side += w + 0.25;
  }
  if (strands) {
    const h = ma.h * 1.15;
    const w = h * aspectOf(strands);
    for (const s of [-1, 1]) add(strands, h, s * (side + w / 2 - 0.1), ma.base + ma.h * 0.42, ma.z - 0.3, s > 0);
    side += w * 0.6;
  }
  if (drape) {
    const h = ma.h * 2.1;
    const w = h * aspectOf(drape);
    // The curtain is drawn hugging the left of its picture; the right one is the mirror.
    for (const s of [-1, 1]) add(drape, h, s * (side + w * 0.25), ma.base - 0.3, ma.z - 0.8, s > 0, false, 4);
    side += w * 0.55;
  }
  if (chand) {
    // A swag above her crown, behind her so it never covers her face.
    const w = ma.w * 2.3;
    const h = w / aspectOf(chand);
    add(chand, h, 0, ma.base + ma.h * 0.93, ma.z - 0.25, false, false, 8);
  }
  return { pieces, lights, side };
}

/** Each frame: the rising lamplight, the red-gold flood from the halo, and the lamp trees' flicker once they burn. */
export function updateShrineDecor(d: ShrineDecor, rise: number, haloAmp: number, treeAmp: number): void {
  const flick = 1 + 0.06 * Math.sin(performance.now() / 90) + 0.04 * Math.sin(performance.now() / 47);
  for (const p of d.pieces) {
    const u = lu(p.mat);
    u.uRise.value = rise;
    u.uRiseGain.value = 0.7 * Math.min(1, rise * 3);
    u.uFlood.value.setRGB(0.5, 0.22, 0.1).multiplyScalar(haloAmp * 0.5);
    if (p.glow) u.uEmissive.value = 0.15 + treeAmp * 0.95 * flick;
  }
  if (d.lights) {
    d.lights.amp(0, treeAmp * 0.55 * flick);
    d.lights.amp(1, treeAmp * 0.55 * flick);
    d.lights.commit();
  }
}
