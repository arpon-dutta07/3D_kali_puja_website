import { gsap } from 'gsap';
import { Color, Mesh, PlaneGeometry, Vector3, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { CameraRig } from '../gl/camera';
import { Glows } from '../gl/glows';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Sparks } from '../gl/sparks';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadTexture } from '../lib/assets';
import { bn, buzz, clamp, damp, isTouch } from '../lib/device';
import type { Chapter } from '../journey';
import { cornerButton, counter, Overlay } from '../ui/overlay';

type Step = 'idle' | 'lamps' | 'finale' | 'done';
type Burst = 'peony' | 'willow' | 'ring' | 'crackle';

const COLORS = ['#ffd27a', '#ff6a3a', '#ff4f9a', '#9affc0', '#ffffff', '#ffb347', '#b48cff', '#ff3b3b'].map((c) => new Color(c));
const GOLD = new Color('#ffd9a0');
const WHITE = new Color('#fff6e8');

interface Rocket {
  x: number;
  y: number;
  vy: number;
  top: number;
  color: Color;
  kind: Burst;
}

/**
 * ছাদের দীপাবলি: an old North Kolkata rooftop at dusk. Fourteen prodips stand on the parapet, the চোদ্দ প্রদীপ for the
 * চোদ্দ পুরুষ; sweep along the ledge to light them. Then the city's Diwali lights come on and the sky goes up.
 */
export class Chhad implements Chapter {
  readonly stage: Stage;
  readonly overlay: Overlay;
  done = false;
  onDone: (() => void) | null = null;
  private rig: CameraRig;
  private step: Step = 'idle';
  private D = 10;
  private view = { w: 1, h: 1 };
  /** One full rooftop photo (round 2), or the older city + cut-out wall. */
  private full = false;
  private ledgeFrac = 0.64;
  private bg!: Mesh;
  private bgMat!: ShaderMaterial;
  private parapet: Mesh | null = null;
  private parapetMat: ShaderMaterial | null = null;
  private wallFrac = 0.35;
  private ledgeY = 0;
  private lamps!: LampField;
  private bowlAspect = 1;
  private carry!: LampField;
  private carryAmp = 0;
  private sparks!: Sparks;
  private flashes!: Glows;
  private flashAmp = new Float32Array(8);
  private nextFlash = 0;
  private rockets: Rocket[] = [];
  private crackles: Array<{ x: number; y: number; t: number }> = [];
  private ambientTimer = 0;
  private pointer = { x: 0, y: 0, px: 0, py: 0, active: false };
  private counterEl: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private tmp = new Vector3();
  /** Depth the fireworks fly at: just in front of the photo, or behind the cut-out wall. */
  private skyZ = -1;

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 45, background: '#05060f' });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.15;
    this.overlay = new Overlay(section);
    this.counterEl = counter(this.overlay.root);
    this.skipBtn = cornerButton(this.overlay.root, config.copy.ui.skip, () => this.skip());
    this.skipBtn.hidden = true;
  }

  async init(): Promise<void> {
    const S = this.stage;
    const portrait = S.aspect < 1;
    const [roof, roofLit, roofTall, roofTallLit, bowlArt] = await Promise.all([
      loadTexture('chhad/rooftop.webp'),
      loadTexture('chhad/rooftop-lit.webp'),
      loadTexture('chhad/rooftop-tall.webp'),
      loadTexture('chhad/rooftop-tall-lit.webp'),
      artOr('common/prodip.webp', ph.prodipBowl),
    ]);

    let pic: Texture | null = null;
    let picLit: Texture | null = null;
    if (portrait && roofTall) {
      pic = roofTall;
      picLit = roofTallLit;
      this.ledgeFrac = config.chhad.ledgeTall;
    } else if (roof) {
      pic = roof;
      picLit = roofLit;
      this.ledgeFrac = config.chhad.ledgeWide;
    }

    if (pic) {
      // Round 2: wall and city in one photo, so they always match.
      this.full = true;
      this.skyZ = 0.05;
      this.bgMat = litMaterial(S, pic, { ambient: 0.62, gain: 0.9, transparent: false });
      if (picLit) lu(this.bgMat).map2.value = picLit;
      lu(this.bgMat).uMixPatchy.value = 1;
      this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(pic)), this.bgMat);
      S.scene.add(this.bg);
    } else {
      const [cityArt, cityLitArt, parapetArt] = await Promise.all([
        artOr('chhad/city.webp', () => ph.city(false)),
        artOr('chhad/city-lit.webp', () => ph.city(true)),
        artOr('chhad/parapet.webp', ph.parapet),
      ]);
      this.bgMat = litMaterial(S, cityArt.tex, { ambient: 0.9, gain: 0, transparent: false });
      lu(this.bgMat).map2.value = cityLitArt.tex;
      lu(this.bgMat).uMixPatchy.value = 1;
      this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(cityArt.tex)), this.bgMat);
      this.bg.position.z = -14;
      S.scene.add(this.bg);
      this.wallFrac = parapetArt.real ? 1 - 0.393 : 0.35;
      this.parapetMat = litMaterial(S, parapetArt.tex, { ambient: 0.16, gain: 1.25 });
      this.parapet = new Mesh(new PlaneGeometry(1, 1 / aspectOf(parapetArt.tex)), this.parapetMat);
      this.parapet.renderOrder = 6;
      S.scene.add(this.parapet);
    }

    // The fourteen prodips.
    this.bowlAspect = aspectOf(bowlArt.tex);
    const flame = bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder;
    const n = config.chhad.lamps;
    this.lamps = new LampField(S, Array.from({ length: n }, () => new Vector3()), 1, {
      bowl: bowlArt.tex,
      bowlAspect: this.bowlAspect,
      ...flame,
      light: 7,
      lightAmp: 0.5,
      ambient: 0.12,
    });
    this.lamps.onIgnite = () => this.onLamp();
    this.carry = new LampField(S, [new Vector3()], 1, { bowl: null, light: 6, lightAmp: 0.5 });
    this.carry.setAll(true, true);
    this.carry.master = 0;

    this.sparks = new Sparks(S, 5000);
    this.sparks.gravity = -1.6;
    this.sparks.drag = 1.1;
    this.flashes = new Glows(8, S.lightScene);

    S.onResize(() => this.layout());
    S.onFrame((dt) => this.update(dt));
    this.bindInput();
  }

  private layout(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    this.view.h = 2 * this.D * tan;
    this.view.w = this.view.h * S.aspect;
    const { w, h } = this.view;
    this.rig.snap({ pos: new Vector3(0, 0, this.D), target: new Vector3(0, 0, 0) });
    const aspect = (m: Mesh) => 1 / (m.geometry as PlaneGeometry).parameters.height;

    if (this.full) {
      // The photo covers the screen (a little extra for the parallax); the ledge is measured on it.
      const a = aspect(this.bg);
      const pw = Math.max(w * 1.06, h * 1.06 * a);
      const ph_ = pw / a;
      this.bg.scale.set(pw, pw, 1);
      this.bg.position.set(0, 0, 0);
      this.ledgeY = ph_ / 2 - ph_ * this.ledgeFrac;
    } else if (this.parapet) {
      const cd = this.D + 14;
      const ch = 2 * cd * tan * 1.12;
      const cs = Math.max(ch * S.aspect, ch * aspect(this.bg));
      this.bg.scale.set(cs, cs, 1);
      const pa = aspect(this.parapet);
      const ph_ = Math.max((w * 1.06) / pa, (h * 0.3) / this.wallFrac);
      this.parapet.scale.set(ph_ * pa, ph_ * pa, 1);
      this.parapet.position.set(0, -h / 2 + ph_ / 2, 0);
      this.ledgeY = -h / 2 + ph_ * this.wallFrac;
    }

    // Fourteen prodips spread along the visible ledge.
    const n = this.lamps.count;
    const span = w * (S.aspect < 1 ? 0.94 : 0.8);
    const gap = span / n;
    // On a phone the fourteen sit almost shoulder to shoulder so each stays big enough to see and to touch.
    const size = clamp(gap * (S.aspect < 1 ? 0.9 : 0.62), 0.18, 0.5);
    for (let i = 0; i < n; i++) {
      const x = -span / 2 + gap * (i + 0.5);
      this.lamps.setSize(i, size);
      this.lamps.setPosition(i, this.tmp.set(x, this.ledgeY + (size / this.bowlAspect) * 0.42, 0.1));
    }
    this.carry.setSize(0, size * 1.1);
  }

  engage(): void {
    if (this.step !== 'idle') return;
    this.step = 'lamps';
    this.skipBtn.hidden = false;
    const c = config.copy.chhad.lamps;
    this.overlay.say('step', isTouch() ? { bn: c.bn } : c, 'top');
    this.counterEl.textContent = `${bn(this.lamps.litCount)} / ${bn(this.lamps.count)}`;
    this.counterEl.classList.add('on');
    this.stage.canvas.classList.add('carry');
  }

  skip(): void {
    if (this.step !== 'lamps') return;
    for (let i = 0; i < this.lamps.count; i++) this.lamps.ignite(i, i * 0.07);
  }

  private bindInput(): void {
    const el = this.section;
    const pos = (e: PointerEvent) => {
      const r = this.stage.canvas.getBoundingClientRect();
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
    };
    el.addEventListener('pointerdown', (e) => {
      if (this.step !== 'lamps') return;
      pos(e);
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.active = true;
      this.sweep();
    });
    el.addEventListener('pointermove', (e) => {
      if (this.step !== 'lamps') return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
      if (this.pointer.active) this.sweep();
    });
    // Sideways sweeps light the ledge; vertical swipes scroll the page.
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') this.pointer.active = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.pointer.active = false;
    });
  }

  /** Light every prodip near the segment the pointer just travelled (a tap lights the one under it). */
  private sweep(): void {
    const r = Math.max(24, ((this.stage.width * 0.8) / this.lamps.count) * 0.62);
    const { px: x0, py: y0, x: x1, y: y1 } = this.pointer;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    for (let i = 0; i < this.lamps.count; i++) {
      if (this.lamps.isLit(i)) continue;
      const s = this.stage.toScreen(this.lamps.flamePoint(i, this.tmp));
      const t = len2 > 0 ? clamp(((s.x - x0) * dx + (s.y - y0) * dy) / len2, 0, 1) : 0;
      if (Math.hypot(x0 + dx * t - s.x, y0 + dy * t - s.y) < r * 1.3) this.lamps.ignite(i, t * 0.06);
    }
  }

  private onLamp(): void {
    buzz(8);
    const lit = this.lamps.litCount;
    this.overlay.hide('step');
    this.counterEl.textContent = `${bn(lit)} / ${bn(this.lamps.count)}`;
    if (this.step === 'lamps' && lit >= this.lamps.count) {
      this.step = 'finale';
      gsap.delayedCall(1.1, () => this.finale());
    }
  }

  /** The city lights up in patches, and the sky goes up in volleys. */
  private finale(): void {
    this.skipBtn.hidden = true;
    this.counterEl.classList.remove('on');
    this.stage.canvas.classList.remove('carry');
    this.pointer.active = false;
    const tl = gsap.timeline();
    // The Diwali-night photo is very bright; stop a little short of it and keep the sky dark enough for the bursts.
    tl.to(lu(this.bgMat).uMix, { value: this.full ? 0.8 : 1, duration: 5.5, ease: 'power1.inOut' }, 0.3);
    if (this.full) tl.to(lu(this.bgMat).uAmbient.value, { r: 0.5, g: 0.5, b: 0.54, duration: 4 }, 0.3);
    else tl.to(lu(this.bgMat).uAmbient.value, { r: 0.78, g: 0.74, b: 0.72, duration: 4 }, 0.3);
    tl.to(this.stage, { bloomBoost: this.full ? 0.1 : 0.35, duration: 2 }, 0.4);
    const kinds: Burst[] = ['peony', 'willow', 'ring', 'crackle'];
    const total = config.chhad.rockets;
    for (let i = 0; i < total; i++) {
      // Singles first, then volleys that build.
      const at = i < 4 ? 0.6 + i * 0.7 : 3.4 + Math.floor((i - 4) / 3) * 1.05 + ((i - 4) % 3) * 0.16;
      tl.call(() => this.launch(kinds[i % kinds.length]!), [], at);
    }
    tl.call(() => {
      const c = config.copy.chhad;
      this.overlay.say('finale', { bn: c.finale, en: c.finaleSub }, 'upper', 0, 'greet');
      buzz([30, 70, 30, 70, 30]);
    }, [], 3);
    tl.call(() => {
      this.step = 'done';
      this.done = true;
      this.onDone?.();
    }, [], 9);
  }

  private launch(kind: Burst): void {
    const { w, h } = this.view;
    const x = (Math.random() - 0.5) * w * 0.84;
    const skyTop = h / 2 - h * 0.1;
    const top = this.ledgeY + h * 0.18 + Math.random() * Math.max(0.5, skyTop - this.ledgeY - h * 0.22);
    this.rockets.push({ x, y: this.ledgeY, vy: h * 0.95, top, color: COLORS[Math.floor(Math.random() * COLORS.length)]!, kind });
  }

  private burst(r: Rocket): void {
    const z = this.skyZ;
    const scale = this.view.h / 8.3;
    const add = (vx: number, vy: number, life: number, size: number, color: Color, heat: number) =>
      this.sparks.emit({ x: r.x, y: r.y, z, vx: vx * scale, vy: vy * scale, life, size: size * scale, color, heat });
    if (r.kind === 'peony') {
      for (let i = 0; i < 190; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.6 + Math.random() * 1.5;
        add(Math.cos(a) * sp, Math.sin(a) * sp, 1.4 + Math.random() * 0.8, 0.11, r.color, 3.8);
      }
    } else if (r.kind === 'willow') {
      for (let i = 0; i < 170; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.0 + Math.random() * 1.3;
        add(Math.cos(a) * sp, Math.sin(a) * sp + 0.4, 2.8 + Math.random() * 1.4, 0.09, GOLD, 3.2);
      }
    } else if (r.kind === 'ring') {
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        add(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 1.5, 0.12, r.color, 4);
        if (i % 2 === 0) add(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 1.3, 0.08, WHITE, 3.4);
      }
    } else {
      for (let i = 0; i < 120; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.3 + Math.random() * 1.6;
        add(Math.cos(a) * sp, Math.sin(a) * sp, 1.0 + Math.random() * 0.5, 0.09, WHITE, 3.6);
      }
      // A second, crackling pop a moment later.
      this.crackles.push({ x: r.x, y: r.y, t: 0.75 });
    }
    const k = this.nextFlash++ % this.flashAmp.length;
    this.flashes.color(k, r.kind === 'willow' ? GOLD : r.color);
    this.flashes.set(k, r.x, r.y, z, this.view.w * 1.1, 0);
    this.flashAmp[k] = 0.6;
    buzz(12);
  }

  private update(dt: number): void {
    const S = this.stage;

    // The flame you carry along the ledge.
    const carrying = this.step === 'lamps' && this.pointer.active;
    this.carryAmp += ((carrying ? 1 : 0) - this.carryAmp) * damp(0.08, dt);
    this.carry.master = this.carryAmp;
    if (carrying) this.carry.setPosition(0, S.fromScreen(this.pointer.x, this.pointer.y, 0.2, this.tmp));

    // Rockets: rise from behind the wall, slow, burst.
    for (const r of this.rockets) {
      r.y += r.vy * dt;
      r.vy *= Math.exp(-1.1 * dt);
      if (Math.random() < 0.85) this.sparks.emit({ x: r.x + (Math.random() - 0.5) * 0.02, y: r.y, z: this.skyZ, vx: 0, vy: -0.3, life: 0.45, size: 0.04, color: GOLD, heat: 2.2 });
      if (r.y >= r.top || r.vy < this.view.h * 0.12) {
        this.burst(r);
        r.vy = -1;
      }
    }
    this.rockets = this.rockets.filter((r) => r.vy >= 0);
    for (const c of this.crackles) {
      c.t -= dt;
      if (c.t <= 0) {
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * this.view.h * 0.12;
          this.sparks.emit({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d - this.view.h * 0.03, z: this.skyZ, vx: 0, vy: 0, life: 0.18 + Math.random() * 0.2, size: 0.09, color: WHITE, heat: 4 });
        }
        buzz(6);
      }
    }
    this.crackles = this.crackles.filter((c) => c.t > 0);

    // After the finale, a rocket now and then while the rooftop is on screen.
    if (this.step === 'done') {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 1.4 + Math.random() * 2.2;
        this.launch((['peony', 'willow', 'ring', 'crackle'] as Burst[])[Math.floor(Math.random() * 4)]!);
      }
    }

    for (let k = 0; k < this.flashAmp.length; k++) {
      this.flashAmp[k] = Math.max(0, this.flashAmp[k]! - dt * 0.7);
      this.flashes.amp(k, this.flashAmp[k]!);
    }
    this.flashes.commit();

    // The fallback wall warms a little as the city lights up.
    if (this.parapetMat) lu(this.parapetMat).uAmbient.value.setScalar(0.16 + lu(this.bgMat).uMix.value * 0.1);
  }
}
