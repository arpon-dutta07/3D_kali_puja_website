import { gsap } from 'gsap';
import { Color, Mesh, PlaneGeometry, Vector3, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { CameraRig } from '../gl/camera';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadSeries, loadTexture } from '../lib/assets';
import { bn, buzz, clamp, damp, isDebug, isTouch } from '../lib/device';
import type { Chapter } from '../journey';
import { cornerButton, counter, Overlay } from '../ui/overlay';

/**
 * Where the fourteen lamps go, in picture coordinates (0,0 top-left, 1,1 bottom-right) of bhoot/house.
 * Tuned for the layout the prompt asks for; with `?debug`, clicking the house logs the spot under the pointer.
 */
const SPOTS: Array<[number, number]> = [
  // Roof: by the potted plant, under the clothesline.
  [0.17, 0.138], [0.6, 0.142],
  // Top floor: side table, foot of the bed, the desk by the window.
  [0.15, 0.308], [0.42, 0.338], [0.69, 0.292],
  // Middle floor: the thakur ghor shelf, the radio, the stairs.
  [0.21, 0.468], [0.51, 0.476], [0.85, 0.452],
  // Ground floor: the stove, the dining table, the stairs.
  [0.17, 0.648], [0.51, 0.668], [0.83, 0.694],
  // Courtyard: tulsi mancha, the door step, by the well.
  [0.47, 0.903], [0.63, 0.888], [0.2, 0.948],
];

/** Seven ghosts, each guarding two of the fourteen lamps; it leaves once both are lit. uv on the house picture. */
type GhostSpec = { uv: [number, number]; spots: [number, number]; size: number };
const GHOSTS: GhostSpec[] = [
  { uv: [0.52, 0.09], spots: [0, 1], size: 0.08 }, // শাঁকচুন্নি among the drying saris
  { uv: [0.25, 0.2], spots: [2, 3], size: 0.075 }, // পেত্নী on top of the almirah
  { uv: [0.6, 0.25], spots: [4, 7], size: 0.08 }, // নিশি at the window
  { uv: [0.4, 0.47], spots: [5, 6], size: 0.075 }, // চোরাচুন্নি in the sitting room
  { uv: [0.29, 0.63], spots: [8, 9], size: 0.075 }, // মেছোভূত in the kitchen
  { uv: [0.75, 0.62], spots: [10, 12], size: 0.085 }, // স্কন্ধকাটা on the stairs
  { uv: [0.35, 0.8], spots: [11, 13], size: 0.085 }, // গেছোভূত from the guava branch
];

/**
 * The wide house for computer screens (bhoot/house-wide). Its spots get measured once the picture exists; until then
 * computers use the tall house, filling the width and travelling up and down it.
 */
const WIDE: { spots: Array<[number, number]>; ghosts: GhostSpec[] } | null = null;

interface Ghost {
  mesh: Mesh;
  mat: ShaderMaterial;
  home: Vector3;
  spots: [number, number];
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
  /** Where the hand lamp is heading (a tap sends it gliding there). */
  private target: Vector3 | null = null;
  private glide = 0.05;
  private spotCount = SPOTS.length;
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
    const [houseArt, bowlArt, wideTex] = await Promise.all([
      artOr('bhoot/house.webp', ph.house),
      artOr('common/prodip.webp', ph.prodipBowl),
      loadTexture('bhoot/house-wide.webp'),
    ]);
    // Computers get the wide house once it exists and its spots are measured; phones keep the tall one.
    const wide = wideTex && WIDE && S.aspect > 1 ? WIDE : null;
    const spotsUv = wide ? wide.spots : SPOTS;
    const ghostsUv = wide ? wide.ghosts : GHOSTS;
    const houseTex = wide && wideTex ? wideTex : houseArt.tex;
    this.spotCount = spotsUv.length;
    let ghostTex: Texture[] = await loadSeries('bhoot/ghost', ghostsUv.length);
    // The drawn stand-ins are dark shapes with glowing eyes; the real ghosts are pale sheets with a faint glow.
    const ghostGlow = ghostTex.length ? 0.12 : 1.6;
    if (!ghostTex.length) ghostTex = ghostsUv.map((_, i) => ph.ghost(i));

    this.W = this.H * aspectOf(houseTex);
    // A faint blue night through the windows; the rest is the lamps.
    this.houseMat = litMaterial(S, houseTex, { ambient: '#06081a', gain: 1.1, transparent: false });
    const house = new Mesh(new PlaneGeometry(this.W, this.H), this.houseMat);
    S.scene.add(house);

    const bowlAspect = aspectOf(bowlArt.tex);
    const flame = bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder;
    const size = this.H * 0.024;
    // Each spot is where the lamp stands; lift the picture so its base sits there.
    const spots = spotsUv.map(([u, v]) => this.world(u, v, 0.05).add(new Vector3(0, (size / bowlAspect) * 0.42, 0)));
    this.lamps = new LampField(S, spots, size, {
      bowl: bowlArt.tex,
      bowlAspect,
      ...flame,
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
      ...flame,
      light: 15,
      lightAmp: 0.6,
      halo: 2.2,
      haloAmp: 0.25,
    });
    this.hand.setAll(true, true);

    for (const [i, g] of ghostsUv.entries()) {
      const tex = ghostTex[i % ghostTex.length]!;
      const h = this.H * g.size;
      const mat = litMaterial(S, tex, { ambient: 0.015, gain: 0.9, emissive: ghostGlow });
      const mesh = new Mesh(new PlaneGeometry(h * aspectOf(tex), h), mat);
      const home = this.world(g.uv[0], g.uv[1], 0.03);
      mesh.position.copy(home);
      mesh.renderOrder = 8;
      S.scene.add(mesh);
      this.ghosts.push({ mesh, mat, home, spots: g.spots, push: 0, gone: 0, phase: i * 1.7 });
    }

    this.handPos.copy(this.world(0.5, 0.5, 0.12));
    S.onResize(() => this.frame());
    S.onFrame((dt, time) => this.update(dt, time));
    this.bindInput();
    this.camY = this.camYTarget = 0;
    this.frame();
  }

  /** The house always fills the whole screen; where it is taller than the screen, the view travels with your lamp. */
  private frame(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    const fitW = (this.W * 0.5) / (tan * S.aspect);
    const fitH = (this.H * 0.5) / tan;
    this.dist = Math.min(fitW, fitH);
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
      this.overlay.say('invite', isTouch() ? { bn: c.inviteTouch } : c.invite, 'top');
      this.counterEl.textContent = `${bn(this.lamps.litCount)} / ${bn(this.spotCount)}`;
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
    // A tap sends the lamp gliding there; a mouse carries it. Vertical swipes still scroll the page.
    const aim = (e: PointerEvent) => {
      const w = this.stage.fromScreen(this.pointer.x, this.pointer.y, 0.12, new Vector3());
      w.x = clamp(w.x, -this.W / 2, this.W / 2);
      w.y = clamp(w.y, -this.H / 2, this.H / 2);
      this.target = w;
      this.glide = e.pointerType === 'mouse' ? 0.05 : 0.14;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged) return;
      pos(e);
      this.pointer.active = true;
      aim(e);
      if (isDebug) {
        const w = this.stage.fromScreen(this.pointer.x, this.pointer.y, 0);
        console.log(`[spot] [${(w.x / this.W + 0.5).toFixed(3)}, ${(0.5 - w.y / this.H).toFixed(3)}]`);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.engaged) return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
      if (this.pointer.active) aim(e);
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
    this.counterEl.textContent = `${bn(n)} / ${bn(this.spotCount)}`;
    buzz(14);
    if (n >= this.spotCount && !this.finished) this.powerBack();
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
    if (this.engaged && !this.finished && this.target) {
      const k = damp(this.glide, dt);
      this.handPos.x += (this.target.x - this.handPos.x) * k;
      this.handPos.y += (this.target.y - this.handPos.y) * k;
    }
    if (this.engaged && !this.finished && this.pointer.active && this.pointer.seen) {
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
      if (this.lamps.isLit(g.spots[0]) && this.lamps.isLit(g.spots[1])) g.gone = Math.min(1, g.gone + dt * 0.7);
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
