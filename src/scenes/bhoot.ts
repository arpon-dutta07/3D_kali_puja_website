import { gsap } from 'gsap';
import { Color, Mesh, PlaneGeometry, Vector3, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { CameraRig } from '../gl/camera';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadSeries } from '../lib/assets';
import { bn, buzz, clamp, damp, isDebug, isTouch } from '../lib/device';
import type { Chapter } from '../journey';
import { cornerButton, counter, Overlay } from '../ui/overlay';

/**
 * Where the fourteen lamps go, in picture coordinates (0,0 top-left, 1,1 bottom-right) of bhoot/house.
 * Tuned for the layout the prompt asks for; with `?debug`, clicking the house logs the spot under the pointer.
 */
const SPOTS: Array<[number, number]> = [
  [0.16, 0.128], [0.62, 0.128],
  [0.17, 0.3], [0.44, 0.325], [0.66, 0.33],
  [0.2, 0.47], [0.42, 0.535], [0.62, 0.535],
  [0.25, 0.735], [0.52, 0.66],
  [0.84, 0.44], [0.84, 0.69],
  [0.5, 0.86], [0.22, 0.94],
];

/** Each ghost waits near one lamp; lighting that lamp sends it away for good. */
const GHOSTS: Array<{ uv: [number, number]; spot: number; size: number }> = [
  { uv: [0.12, 0.25], spot: 2, size: 0.11 }, // শাঁকচুন্নি at the bedroom window
  { uv: [0.36, 0.7], spot: 8, size: 0.1 }, // মেছোভূত in the kitchen
  { uv: [0.78, 0.6], spot: 11, size: 0.11 }, // স্কন্ধকাটা on the stairs
  { uv: [0.24, 0.84], spot: 13, size: 0.12 }, // গেছোভূত in the guava tree
  { uv: [0.6, 0.09], spot: 1, size: 0.1 }, // একানড়ে on the roof
  { uv: [0.52, 0.45], spot: 6, size: 0.09 }, // পেত্নী in the sitting room
];

interface Ghost {
  mesh: Mesh;
  mat: ShaderMaterial;
  home: Vector3;
  spot: number;
  push: number;
  gone: number;
  phase: number;
}

/**
 * ভূত চতুর্দশী: a power cut in an old North Kolkata house. Carry a prodip through the dark rooms, light the fourteen
 * lamps; the ghosts shrink from your light and leave when their corner is lit. Then the power comes back.
 */
export class Bhoot implements Chapter {
  readonly stage: Stage;
  readonly overlay: Overlay;
  done = false;
  onDone: (() => void) | null = null;
  private rig: CameraRig;
  private houseMat!: ShaderMaterial;
  private W = 5.6;
  private H = 10;
  private lamps!: LampField;
  private hand!: LampField;
  private ghosts: Ghost[] = [];
  private engaged = false;
  private finished = false;
  private pointer = { x: 0, y: 0, active: false, seen: false };
  private handPos = new Vector3();
  private camY = 0;
  private camYTarget = 0;
  private dist = 10;
  private counterEl: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private flood = 0;
  private tmp = new Vector3();

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 40 });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.12;
    this.overlay = new Overlay(section);
    this.counterEl = counter(this.overlay.root);
    this.skipBtn = cornerButton(this.overlay.root, config.copy.ui.skip, () => this.skip());
    this.skipBtn.hidden = true;
  }

  private world(u: number, v: number, z = 0): Vector3 {
    return new Vector3((u - 0.5) * this.W, (0.5 - v) * this.H, z);
  }

  async init(): Promise<void> {
    const S = this.stage;
    const [houseArt, bowlArt] = await Promise.all([
      artOr('bhoot/house.webp', ph.house),
      artOr('common/prodip.webp', ph.prodipBowl),
    ]);
    let ghostTex: Texture[] = await loadSeries('bhoot/ghost', 6);
    if (!ghostTex.length) ghostTex = [0, 1, 2, 3, 4, 5].map((i) => ph.ghost(i));

    this.W = this.H * aspectOf(houseArt.tex);
    // A faint blue night through the windows; the rest is the lamps.
    this.houseMat = litMaterial(S, houseArt.tex, { ambient: '#06081a', gain: 1.1, transparent: false });
    const house = new Mesh(new PlaneGeometry(this.W, this.H), this.houseMat);
    S.scene.add(house);

    const bowlAspect = aspectOf(bowlArt.tex);
    const size = this.H * 0.022;
    const spots = SPOTS.map(([u, v]) => this.world(u, v, 0.05));
    this.lamps = new LampField(S, spots, size, {
      bowl: bowlArt.tex,
      bowlAspect,
      light: 13,
      lightAmp: 0.42,
      halo: 2,
      haloAmp: 0.2,
      ambient: 0.05,
    });
    this.lamps.onIgnite = () => this.onLit();
    this.hand = new LampField(S, [new Vector3(0, 0, 0.12)], size * 1.25, {
      bowl: bowlArt.tex,
      bowlAspect,
      light: 15,
      lightAmp: 0.6,
      halo: 2.2,
      haloAmp: 0.25,
    });
    this.hand.setAll(true, true);

    for (const [i, g] of GHOSTS.entries()) {
      const tex = ghostTex[i % ghostTex.length]!;
      const h = this.H * g.size;
      const mat = litMaterial(S, tex, { ambient: 0.015, gain: 0.9, emissive: 1.6 });
      const mesh = new Mesh(new PlaneGeometry(h * aspectOf(tex), h), mat);
      const home = this.world(g.uv[0], g.uv[1], 0.03);
      mesh.position.copy(home);
      mesh.renderOrder = 8;
      S.scene.add(mesh);
      this.ghosts.push({ mesh, mat, home, spot: g.spot, push: 0, gone: 0, phase: i * 1.7 });
    }

    this.handPos.copy(this.world(0.5, 0.5, 0.12));
    S.onResize(() => this.frame());
    S.onFrame((dt, time) => this.update(dt, time));
    this.bindInput();
    this.camY = this.camYTarget = 0;
    this.frame();
  }

  /** Fit the house's width; the camera then travels up and down with your lamp. */
  private frame(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    const fitW = (this.W * 0.5) / (tan * S.aspect * 0.96);
    const fitH = (this.H * 0.5) / (tan * 0.98);
    // Landscape screens show more of the house at once (it stays a tall picture you travel along).
    this.dist = Math.min(fitH, S.aspect > 1 ? fitW * 1.6 : fitW);
    this.place();
  }

  private place(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    const halfView = this.dist * tan;
    const maxY = Math.max(0, this.H / 2 - halfView);
    this.camY = clamp(this.camY, -maxY, maxY);
    this.camYTarget = clamp(this.camYTarget, -maxY, maxY);
    this.rig.snap({ pos: new Vector3(0, this.camY, this.dist), target: new Vector3(0, this.camY, 0) });
  }

  engage(): void {
    if (this.engaged || this.done) return;
    this.engaged = true;
    const c = config.copy.bhoot;
    this.overlay.say('start', c.start, 'top', 2.6);
    gsap.delayedCall(2.4, () => {
      if (this.finished) return;
      this.overlay.say('invite', { bn: c.invite.bn, en: isTouch() ? undefined : c.invite.en }, 'top');
      this.counterEl.textContent = `${bn(0)} / ${bn(SPOTS.length)}`;
      this.counterEl.classList.add('on');
    });
    this.skipBtn.hidden = false;
    this.stage.canvas.classList.add('carry');
  }

  skip(): void {
    if (this.finished) return;
    for (let i = 0; i < this.lamps.count; i++) this.lamps.ignite(i, i * 0.06);
  }

  private bindInput(): void {
    const el = this.section;
    const pos = (e: PointerEvent) => {
      const r = this.stage.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.seen = true;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged) return;
      pos(e);
      this.pointer.active = true;
      this.stage.canvas.setPointerCapture?.(e.pointerId);
      if (isDebug) {
        const w = this.stage.fromScreen(this.pointer.x, this.pointer.y, 0);
        console.log(`[spot] [${(w.x / this.W + 0.5).toFixed(3)}, ${(0.5 - w.y / this.H).toFixed(3)}]`);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.engaged) return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') this.pointer.active = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private onLit(): void {
    const n = this.lamps.litCount;
    this.overlay.hide('invite');
    this.counterEl.textContent = `${bn(n)} / ${bn(SPOTS.length)}`;
    buzz(14);
    if (n >= SPOTS.length && !this.finished) this.powerBack();
  }

  /** The tube lights blink, blink, then hold; the ghosts are gone. */
  private powerBack(): void {
    this.finished = true;
    this.skipBtn.hidden = true;
    this.stage.canvas.classList.remove('carry');
    this.counterEl.classList.remove('on');
    const tl = gsap.timeline({ delay: 1.1 });
    const blink = [0.0, 0.7, 0.0, 0.0, 0.9, 0.15, 1];
    const times = [0, 0.08, 0.16, 0.5, 0.58, 0.68, 0.9];
    blink.forEach((v, i) => tl.set(this, { flood: v }, times[i]));
    tl.call(() => {
      buzz([40, 50, 40]);
      for (const g of this.ghosts) g.gone = 1;
    }, [], 0.6);
    tl.call(() => this.overlay.say('done', config.copy.bhoot.done, 'bottom'), [], 1.3);
    tl.call(() => {
      this.done = true;
      this.onDone?.();
    }, [], 2.6);
  }

  private update(dt: number, time: number): void {
    const S = this.stage;
    // The lamp in your hand.
    if (this.engaged && !this.finished && this.pointer.active && this.pointer.seen) {
      const w = S.fromScreen(this.pointer.x, this.pointer.y, 0.12, this.tmp);
      w.x = clamp(w.x, -this.W / 2, this.W / 2);
      w.y = clamp(w.y, -this.H / 2, this.H / 2);
      const k = damp(0.05, dt);
      this.handPos.x += (w.x - this.handPos.x) * k;
      this.handPos.y += (w.y - this.handPos.y) * k;
      // Near the top or bottom edge of the screen, the view follows.
      const edge = S.height * 0.2;
      if (this.pointer.y > S.height - edge) this.camYTarget -= ((this.pointer.y - (S.height - edge)) / edge) * dt * 3.2;
      if (this.pointer.y < edge) this.camYTarget += ((edge - this.pointer.y) / edge) * dt * 3.2;
    }
    const handLift = this.H * 0.012;
    this.hand.setPosition(0, this.tmp.set(this.handPos.x, this.handPos.y - handLift, 0.12));
    this.hand.master = this.finished ? Math.max(0, 1 - this.flood) : 1;

    // Bring the flame to an unlit lamp to light it.
    if (this.engaged && !this.finished) {
      const r = this.H * config.bhoot.catchRadius;
      for (let i = 0; i < this.lamps.count; i++) {
        if (this.lamps.isLit(i)) continue;
        const p = this.lamps.pos[i]!;
        if (Math.hypot(p.x - this.handPos.x, p.y - this.handPos.y) < r) this.lamps.ignite(i);
      }
    }

    this.camY += (this.camYTarget - this.camY) * damp(0.25, dt);
    this.place();

    // Ghosts: flinch from light, leave when their lamp is lit.
    for (const g of this.ghosts) {
      if (this.lamps.isLit(g.spot)) g.gone = Math.min(1, g.gone + dt * 0.7);
      const dx = g.home.x - this.handPos.x;
      const dy = g.home.y - this.handPos.y;
      const d = Math.hypot(dx, dy) || 1;
      const near = clamp(1 - d / (this.H * 0.16), 0, 1);
      g.push += (near - g.push) * damp(0.15, dt);
      const away = g.push * this.H * 0.05 + g.gone * this.H * 0.12;
      const bob = Math.sin(time * 1.6 + g.phase) * this.H * 0.004;
      g.mesh.position.set(g.home.x + (dx / d) * away, g.home.y + (dy / d) * away * 0.4 + bob + g.gone * this.H * 0.05, 0.03);
      g.mesh.rotation.z = Math.sin(time * 1.1 + g.phase) * 0.05;
      lu(g.mat).uOpacity.value = (1 - g.gone) * (1 - g.push * 0.55);
    }

    // Tube light: a flat cool white over everything.
    lu(this.houseMat).uFlood.value.copy(TUBE).multiplyScalar(this.flood * 0.78);
    this.lamps.master = 1 - this.flood * 0.5;
  }
}

const TUBE = new Color(config.palette.tube);
