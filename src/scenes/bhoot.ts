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
 * One room of the house: where its prodip stands (the middle of the floor) and who waits there. Picture coordinates,
 * u from the left and v from the top; a ghost stands with its feet at `feet`, `size` is its height as a share of the
 * picture's, `ghost` picks bhoot/ghost-N (0 = ghost-1). With `?debug`, clicking the house logs the spot under it.
 */
type Room = { lamp: [number, number]; ghost: number; u: number; feet: number; size: number };

/** The wide house (bhoot/house-wide), for computer screens: four rooms upstairs, three down. */
const WIDE: Room[] = [
  { lamp: [0.2, 0.565], ghost: 1, u: 0.295, feet: 0.555, size: 0.3 }, // bedroom: পেত্নী by the almirah
  { lamp: [0.405, 0.565], ghost: 3, u: 0.457, feet: 0.555, size: 0.3 }, // thakur ghor: ব্রহ্মদৈত্য
  { lamp: [0.635, 0.565], ghost: 2, u: 0.555, feet: 0.555, size: 0.3 }, // the stairs: নিশি in the dark under them
  { lamp: [0.8, 0.565], ghost: 0, u: 0.895, feet: 0.555, size: 0.3 }, // sitting room: শাঁকচুন্নি by the window
  { lamp: [0.17, 0.925], ghost: 4, u: 0.265, feet: 0.915, size: 0.3 }, // kitchen: মেছোভূত
  { lamp: [0.535, 0.925], ghost: 6, u: 0.4, feet: 0.915, size: 0.28 }, // courtyard: যখ by the well
  { lamp: [0.8, 0.925], ghost: 5, u: 0.895, feet: 0.915, size: 0.3 }, // dining room: কানাভুলো
];

/** The tall house (bhoot/house), for phones: three floors of a room and a stairwell each, and the courtyard. */
const TALL: Room[] = [
  { lamp: [0.45, 0.35], ghost: 1, u: 0.22, feet: 0.345, size: 0.15 }, // bedroom: পেত্নী by the almirah
  { lamp: [0.79, 0.352], ghost: 2, u: 0.875, feet: 0.34, size: 0.13 }, // top stairwell: নিশি
  { lamp: [0.45, 0.537], ghost: 3, u: 0.22, feet: 0.532, size: 0.15 }, // sitting room by the thakur shelf: ব্রহ্মদৈত্য
  { lamp: [0.79, 0.54], ghost: 0, u: 0.875, feet: 0.53, size: 0.13 }, // middle stairwell: শাঁকচুন্নি
  { lamp: [0.45, 0.733], ghost: 4, u: 0.22, feet: 0.727, size: 0.15 }, // kitchen: মেছোভূত
  { lamp: [0.79, 0.735], ghost: 5, u: 0.875, feet: 0.722, size: 0.13 }, // bottom stairwell: কানাভুলো
  { lamp: [0.62, 0.93], ghost: 6, u: 0.3, feet: 0.92, size: 0.15 }, // courtyard: যখ
];

type GhostState = 'lurk' | 'seen' | 'flee' | 'gone';

interface Ghost {
  mesh: Mesh;
  mat: ShaderMaterial;
  home: Vector3;
  h: number;
  room: number;
  state: GhostState;
  t: number;
  near: number;
  phase: number;
  /** Which way it runs: away from the room's lamp. */
  dir: number;
  label: HTMLElement;
}

/** How long a ghost stays in the light before it runs, and how long the running takes. */
const SEEN = 1.7;
const FLEE = 1.2;

/**
 * ভূত চতুর্দশী: a power cut in an old North Kolkata house, the whole house in view and holding still. Carry a prodip
 * from room to room; in each, someone is standing in the dark. Your light shows them, and once the room's lamp is
 * lit they are seen for a moment, named, and gone. Seven rooms, seven lamps, then the power comes back.
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
  private pointer = { x: 0, y: 0, active: false };
  private handPos = new Vector3();
  /** Where the hand lamp is heading (a tap sends it gliding there). */
  private target: Vector3 | null = null;
  private glide = 0.05;
  private counterEl: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private flood = 0;
  private tmp = new Vector3();

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 40 });
    this.rig = new CameraRig(this.stage);
    // The house holds still: no drift, nothing to chase.
    this.rig.sway = 0;
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
    // Computers get the wide house, phones the tall one.
    const wide = !!wideTex && S.aspect > 1;
    const rooms = wide ? WIDE : TALL;
    const houseTex = wide && wideTex ? wideTex : houseArt.tex;
    let ghostTex: Texture[] = await loadSeries('bhoot/ghost', 7);
    if (!ghostTex.length) ghostTex = rooms.map((_, i) => ph.ghost(i));

    this.W = this.H * aspectOf(houseTex);
    // A faint blue night through the windows; the rest is the lamps.
    this.houseMat = litMaterial(S, houseTex, { ambient: '#06081a', gain: 1.1, transparent: false });
    const house = new Mesh(new PlaneGeometry(this.W, this.H), this.houseMat);
    S.scene.add(house);

    const bowlAspect = aspectOf(bowlArt.tex);
    const flame = bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder;
    const size = this.H * (wide ? 0.05 : 0.03);
    // Each spot is where the lamp stands; lift the picture so its base sits there.
    const spots = rooms.map((r) => this.world(r.lamp[0], r.lamp[1], 0.05).add(new Vector3(0, (size / bowlAspect) * 0.42, 0)));
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
    this.hand = new LampField(S, [new Vector3(0, 0, 0.12)], size * 1.2, {
      bowl: bowlArt.tex,
      bowlAspect,
      ...flame,
      light: 19,
      lightAmp: 0.85,
      halo: 2.2,
      haloAmp: 0.25,
    });
    this.hand.setAll(true, true);

    const names = config.copy.bhoot.ghosts;
    for (const [i, r] of rooms.entries()) {
      const tex = ghostTex[r.ghost % ghostTex.length]!;
      const h = this.H * r.size;
      // Lit only by light: in the dark room they are almost nothing; your lamp brings them out.
      const mat = litMaterial(S, tex, { ambient: 0, gain: 1.05, emissive: 0.12 });
      const mesh = new Mesh(new PlaneGeometry(h * aspectOf(tex), h), mat);
      const home = this.world(r.u, r.feet, 0.03).add(new Vector3(0, h / 2, 0));
      mesh.position.copy(home);
      mesh.renderOrder = 8;
      S.scene.add(mesh);
      const label = document.createElement('div');
      label.className = 'ghost-name';
      label.textContent = names[r.ghost] ?? '';
      this.overlay.root.appendChild(label);
      this.ghosts.push({ mesh, mat, home, h, room: i, state: 'lurk', t: 0, near: 0, phase: i * 1.7, dir: Math.sign(r.u - r.lamp[0]) || 1, label });
    }

    this.handPos.copy(this.world(0.5, wide ? 0.42 : 0.45, 0.12));
    S.onResize(() => this.frame());
    S.onFrame((dt, time) => this.update(dt, time));
    this.bindInput();
    this.frame();
  }

  /** The whole house on screen, always: nothing to scroll or pan to. */
  private frame(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    const fitW = (this.W * 0.5) / (tan * S.aspect);
    const fitH = (this.H * 0.5) / tan;
    const d = Math.max(fitW, fitH) * 1.01;
    this.rig.snap({ pos: new Vector3(0, 0, d), target: new Vector3(0, 0, 0) });
  }

  engage(): void {
    if (this.engaged || this.done) return;
    this.engaged = true;
    const c = config.copy.bhoot;
    this.overlay.say('start', c.start, 'top', 2.6);
    gsap.delayedCall(2.4, () => {
      if (this.finished) return;
      this.overlay.say('invite', isTouch() ? { bn: c.inviteTouch } : c.invite, 'top');
      this.counterEl.textContent = `${bn(this.lamps.litCount)} / ${bn(this.lamps.count)}`;
      this.counterEl.classList.add('on');
    });
    this.skipBtn.hidden = false;
    // While you play, a finger on the house moves the lamp instead of the page.
    this.stage.canvas.classList.add('carry', 'hold');
  }

  skip(): void {
    if (this.finished) return;
    for (let i = 0; i < this.lamps.count; i++) this.lamps.ignite(i, i * 0.25);
  }

  private bindInput(): void {
    const el = this.section;
    const pos = (e: PointerEvent) => {
      const r = this.stage.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
    };
    // A tap sends the lamp gliding there; a mouse or a finger carries it.
    const aim = (e: PointerEvent) => {
      const w = this.stage.fromScreen(this.pointer.x, this.pointer.y, 0.12, new Vector3());
      w.x = clamp(w.x, -this.W / 2, this.W / 2);
      w.y = clamp(w.y, -this.H / 2, this.H / 2);
      this.target = w;
      this.glide = e.pointerType === 'mouse' ? 0.05 : 0.1;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged || this.finished) return;
      pos(e);
      this.pointer.active = true;
      aim(e);
      if (isDebug) {
        const w = this.stage.fromScreen(this.pointer.x, this.pointer.y, 0);
        console.log(`[spot] [${(w.x / this.W + 0.5).toFixed(3)}, ${(0.5 - w.y / this.H).toFixed(3)}]`);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.engaged || this.finished) return;
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
    this.counterEl.textContent = `${bn(n)} / ${bn(this.lamps.count)}`;
    buzz(14);
    if (n >= this.lamps.count && !this.finished) {
      this.finished = true;
      this.skipBtn.hidden = true;
      this.counterEl.classList.remove('on');
      // The last one gets its moment in the light before the power comes back.
      gsap.delayedCall(SEEN + FLEE * 0.6, () => this.powerBack());
    }
  }

  /** The tube lights blink, blink, then hold. */
  private powerBack(): void {
    this.stage.canvas.classList.remove('carry', 'hold');
    const tl = gsap.timeline({ delay: 0.4 });
    const blink = [0.0, 0.7, 0.0, 0.0, 0.9, 0.15, 1];
    const times = [0, 0.08, 0.16, 0.5, 0.58, 0.68, 0.9];
    blink.forEach((v, i) => tl.set(this, { flood: v }, times[i]));
    tl.call(() => buzz([40, 50, 40]), [], 0.6);
    tl.call(() => this.overlay.say('done', config.copy.bhoot.done, 'bottom'), [], 1.3);
    tl.call(() => {
      this.done = true;
      this.onDone?.();
    }, [], 2.6);
  }

  private update(dt: number, time: number): void {
    // The lamp in your hand.
    if (this.engaged && this.target) {
      const k = damp(this.glide, dt);
      this.handPos.x += (this.target.x - this.handPos.x) * k;
      this.handPos.y += (this.target.y - this.handPos.y) * k;
    }
    const handLift = this.H * 0.012;
    this.hand.setPosition(0, this.tmp.set(this.handPos.x, this.handPos.y - handLift, 0.12));
    this.hand.master = this.finished ? Math.max(0, 1 - this.flood) : this.engaged ? 1 : 0.85;

    // Bring the flame to an unlit lamp to light it.
    if (this.engaged && !this.finished) {
      const r = this.H * config.bhoot.catchRadius;
      for (let i = 0; i < this.lamps.count; i++) {
        if (this.lamps.isLit(i)) continue;
        const p = this.lamps.pos[i]!;
        if (Math.hypot(p.x - this.handPos.x, p.y - this.handPos.y) < r) this.lamps.ignite(i);
      }
    }

    for (const g of this.ghosts) this.updateGhost(g, dt, time);

    // Tube light: a flat cool white over everything.
    lu(this.houseMat).uFlood.value.copy(TUBE).multiplyScalar(this.flood * 0.78);
    this.lamps.master = 1 - this.flood * 0.5;
  }

  /** In the dark: barely there. In your light: plain to see. Its lamp lit: seen, named, and gone. */
  private updateGhost(g: Ghost, dt: number, time: number): void {
    const u = lu(g.mat);
    if (g.state === 'gone') return;
    const dx = g.home.x - this.handPos.x;
    const dy = g.home.y - this.handPos.y;
    const near = clamp(1 - Math.hypot(dx, dy) / (this.H * 0.28), 0, 1);
    g.near += (near - g.near) * damp(0.2, dt);
    const bob = Math.sin(time * 1.4 + g.phase) * this.H * 0.004;
    let x = g.home.x;
    let y = g.home.y + bob;
    let sx = 1;
    let sy = 1;
    let op = 1;
    // How lit it is: your lamp brings it up as you come close; caught in its own room's light, it is plain to see.
    let light = 0.02 + g.near * 0.5;

    if (g.state === 'lurk') {
      // A slow sway, leaning a little towards the light that is coming.
      g.mesh.rotation.z = Math.sin(time * 0.9 + g.phase) * 0.03;
      if (this.lamps.isLit(g.room)) {
        g.state = 'seen';
        g.t = 0;
        buzz([18, 40, 30]);
        g.label.classList.add('on');
      }
    } else if (g.state === 'seen') {
      g.t += dt;
      // Caught in the light: a start, a shudder, held there.
      const k = Math.min(1, g.t / 0.3);
      light = 0.02 + g.near * 0.5 + (1.15 - 0.02 - g.near * 0.5) * k;
      const punch = Math.sin(Math.min(1, g.t / 0.4) * Math.PI) * 0.09;
      sx = sy = 1 + punch;
      x += Math.sin(g.t * 55) * this.H * 0.006 * Math.max(0, 1 - g.t / 0.7);
      if (g.t >= SEEN) {
        g.state = 'flee';
        g.t = 0;
        g.label.classList.remove('on');
      }
    } else {
      g.t += dt;
      // Away from the lamp, up and thin into the dark.
      const k = Math.min(1, g.t / FLEE);
      const e = k * k * (3 - 2 * k);
      light = 1.15;
      x += g.dir * e * this.H * 0.16;
      y += e * this.H * 0.05;
      sx = 1 - 0.35 * e;
      sy = 1 + 0.12 * e;
      op = 1 - e;
      g.mesh.rotation.z = g.dir * e * 0.18;
      if (k >= 1) {
        g.state = 'gone';
        g.mesh.visible = false;
      }
    }
    g.mesh.position.set(x, y, 0.03);
    g.mesh.scale.set(sx, sy, 1);
    // A flat warm light (the picture's mid-tones never reach the emissive range); its eyes glow a little in the dark.
    u.uFlood.value.copy(LAMPLIGHT).multiplyScalar(light);
    u.uEmissive.value = 0.12 + light * 0.4;
    u.uOpacity.value = op;
    if (g.state === 'seen' || g.state === 'flee') {
      // The name floats over its head.
      const s = this.stage.toScreen(this.tmp.set(x, y + g.h * 0.55, 0.03));
      g.label.style.translate = `${s.x}px ${s.y}px`;
    }
  }
}

const TUBE = new Color(config.palette.tube);
const LAMPLIGHT = new Color(1, 0.86, 0.7);
