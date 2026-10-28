import { gsap } from 'gsap';
import { Color, Mesh, PlaneGeometry, Vector3, type ShaderMaterial } from 'three';
import { config } from '../config';
import { CameraRig } from '../gl/camera';
import { Glows } from '../gl/glows';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Sparks } from '../gl/sparks';
import { Stage } from '../gl/stage';
import { artOr, aspectOf } from '../lib/assets';
import { buzz, clamp, damp, isTouch } from '../lib/device';
import type { Chapter } from '../journey';
import { cornerButton, Overlay } from '../ui/overlay';

type Step = 'idle' | 'candles' | 'lantern' | 'tubri' | 'sparkler' | 'finale' | 'done';

const ROCKET_COLORS = ['#ffd27a', '#ff6a3a', '#ff4f9a', '#9affc0', '#ffffff', '#ffb347'].map((c) => new Color(c));
const GOLD = new Color('#ffd9a0');

/**
 * ছাদের দীপাবলি: a North Kolkata rooftop at dusk. Light the candles along the parapet, pull the rope to raise the
 * akash prodip, light the tubri, write on the sky with a phuljhuri; then the whole city lights up.
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
  private cityMat!: ShaderMaterial;
  private city!: Mesh;
  private parapetMat!: ShaderMaterial;
  private parapet!: Mesh;
  private ledgeY = 0;
  private candles!: LampField;
  private prodips!: LampField;
  private nCandles = 12;
  private candleAspect = 1;
  private bowlAspect = 1;
  private lastInk: { x: number; y: number } | null = null;
  private carry!: LampField;
  private carryAmp = 0;
  private pole!: Mesh;
  private poleX = 0;
  private poleTop = 0;
  private lantern!: Mesh;
  private lanternMat!: ShaderMaterial;
  private lanternLight!: Glows;
  private lanternUp = 0;
  private lanternLit = 0;
  private handle = { y0: 0, drag: false, startY: 0, startUp: 0 };
  private tubri!: Mesh;
  private tubriPos = new Vector3();
  private tubriOn = 0;
  private tubriLight!: Glows;
  private sparks!: Sparks;
  private flashes!: Glows;
  private rockets: Array<{ x: number; y: number; vy: number; tY: number; color: Color; t: number }> = [];
  private flashAmp = new Float32Array(6);
  private nextFlash = 0;
  private pointer = { x: 0, y: 0, px: 0, py: 0, down: false, active: false };
  private ink = 0;
  private rope: HTMLCanvasElement;
  private ropeCtx: CanvasRenderingContext2D;
  private trail: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;
  private skipBtn: HTMLButtonElement;
  private doneTimer: gsap.core.Tween | null = null;
  private tmp = new Vector3();

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 45, background: '#05060f' });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.25;
    this.rope = document.createElement('canvas');
    this.rope.className = 'thread';
    this.trail = document.createElement('canvas');
    this.trail.className = 'thread trail';
    section.append(this.trail, this.rope);
    this.ropeCtx = this.rope.getContext('2d')!;
    this.trailCtx = this.trail.getContext('2d')!;
    this.overlay = new Overlay(section);
    this.skipBtn = cornerButton(this.overlay.root, config.copy.ui.skip, () => this.skip());
    this.skipBtn.hidden = true;
  }

  async init(): Promise<void> {
    const S = this.stage;
    const [cityArt, cityLitArt, parapetArt, candleArt, bowlArt, lanternArt, poleArt, tubriArt] = await Promise.all([
      artOr('chhad/city.webp', () => ph.city(false)),
      artOr('chhad/city-lit.webp', () => ph.city(true)),
      artOr('chhad/parapet.webp', ph.parapet),
      artOr('chhad/candle.webp', ph.candle),
      artOr('common/prodip.webp', ph.prodipBowl),
      artOr('chhad/akash-prodip.webp', ph.lantern),
      artOr('chhad/pole.webp', ph.pole),
      artOr('chhad/tubri.webp', ph.tubri),
    ]);

    this.cityMat = litMaterial(S, cityArt.tex, { ambient: 0.9, gain: 0, transparent: false });
    lu(this.cityMat).map2.value = cityLitArt.tex;
    lu(this.cityMat).uMixPatchy.value = 1;
    this.city = new Mesh(new PlaneGeometry(1, 1 / aspectOf(cityArt.tex)), this.cityMat);
    this.city.position.z = -14;
    S.scene.add(this.city);

    this.parapetMat = litMaterial(S, parapetArt.tex, { ambient: 0.16, gain: 1.25 });
    this.parapet = new Mesh(new PlaneGeometry(1, 1 / aspectOf(parapetArt.tex)), this.parapetMat);
    this.parapet.renderOrder = 6;
    S.scene.add(this.parapet);

    this.pole = new Mesh(new PlaneGeometry(1, 1 / aspectOf(poleArt.tex)), litMaterial(S, poleArt.tex, { ambient: 0.14, gain: 1.1 }));
    this.pole.renderOrder = 4;
    this.pole.position.z = -0.6;
    S.scene.add(this.pole);
    this.lanternMat = litMaterial(S, lanternArt.tex, { ambient: 0.12, gain: 1.0, emissive: 0 });
    this.lantern = new Mesh(new PlaneGeometry(1, 1 / aspectOf(lanternArt.tex)), this.lanternMat);
    this.lantern.renderOrder = 5;
    S.scene.add(this.lantern);
    this.lanternLight = new Glows(1, S.lightScene);
    this.lanternLight.color(0, '#ffc98a');

    this.tubri = new Mesh(new PlaneGeometry(1, 1 / aspectOf(tubriArt.tex)), litMaterial(S, tubriArt.tex, { ambient: 0.14, gain: 1.2 }));
    this.tubri.renderOrder = 7;
    S.scene.add(this.tubri);
    this.tubriLight = new Glows(1, S.lightScene);
    this.tubriLight.color(0, '#ffd9a0');

    this.sparks = new Sparks(S, 2600);
    this.sparks.gravity = -3.2;
    this.sparks.drag = 0.9;
    this.flashes = new Glows(6, S.lightScene);

    // Candles and clay lamps take turns along the ledge; fewer on a phone so a finger can sweep them.
    this.nCandles = S.aspect < 1 ? 7 : config.chhad.candles;
    const nC = Math.ceil(this.nCandles / 2);
    const nP = this.nCandles - nC;
    const zero = (n: number) => Array.from({ length: n }, () => new Vector3());
    this.candleAspect = aspectOf(candleArt.tex);
    this.bowlAspect = aspectOf(bowlArt.tex);
    this.candles = new LampField(S, zero(nC), 1, { bowl: candleArt.tex, bowlAspect: this.candleAspect, flameLift: 0.5, flameSize: 0.9, light: 7, lightAmp: 0.5 });
    this.prodips = new LampField(S, zero(nP), 1, { bowl: bowlArt.tex, bowlAspect: this.bowlAspect, flameLift: 0.16, light: 7, lightAmp: 0.5 });
    this.candles.onIgnite = this.prodips.onIgnite = () => this.onCandle();
    this.carry = new LampField(S, [new Vector3()], 1, { bowl: null, light: 6, lightAmp: 0.5 });
    this.carry.setAll(true, true);
    this.carry.master = 0;

    S.onResize(() => this.layout());
    S.onFrame((dt, time) => this.update(dt, time));
    this.bindInput();
  }

  /** Everything is placed relative to what the camera sees, so phones and desktops both get a full rooftop. */
  private layout(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    this.D = 10;
    this.view.h = 2 * this.D * tan;
    this.view.w = this.view.h * S.aspect;
    const { w, h } = this.view;
    this.rig.snap({ pos: new Vector3(0, 0, this.D), target: new Vector3(0, 0, 0) });

    // City far behind, covering the view with room for parallax.
    const cd = this.D + 14;
    const ch = 2 * cd * tan * 1.12;
    const cw = ch * S.aspect;
    const cityAspect = aspectOfMesh(this.city);
    const cs = Math.max(cw, ch * cityAspect);
    this.city.scale.set(cs, cs, 1);
    this.city.position.y = 0;

    // Parapet: the wall is the bottom 35% of its picture; make that about 30% of the screen.
    const pAspect = aspectOfMesh(this.parapet);
    const ph_ = Math.max((w * 1.1) / pAspect, (h * 0.3) / 0.35);
    const pw = ph_ * pAspect;
    this.parapet.scale.set(pw, pw, 1);
    this.parapet.position.set(0, -h / 2 + ph_ / 2, 0);
    this.ledgeY = -h / 2 + ph_ * 0.35;

    // Candles along the ledge, between the tubri (left) and the pole (right).
    const span = w * 0.62;
    const size = clamp(span / this.nCandles, 0.26, 0.62) * 0.75;
    let iC = 0;
    let iP = 0;
    for (let i = 0; i < this.nCandles; i++) {
      const x = -span / 2 + (span * (i + 0.5)) / this.nCandles - w * 0.03;
      if (i % 2 === 0) {
        this.candles.setSize(iC, size * 0.7);
        this.candles.setPosition(iC++, this.tmp.set(x, this.ledgeY + (size * 0.7) / this.candleAspect / 2, 0.1));
      } else {
        this.prodips.setSize(iP, size);
        this.prodips.setPosition(iP++, this.tmp.set(x, this.ledgeY + (size / this.bowlAspect) * 0.42, 0.1));
      }
    }
    this.carry.setSize(0, size * 1.1);

    // The tubri on the left end of the ledge.
    const ts = size * 1.3;
    const tAspect = aspectOfMesh(this.tubri);
    this.tubri.scale.set(ts, ts, 1);
    this.tubriPos.set(-w * 0.4, this.ledgeY + ts / tAspect / 2, 0.1);
    this.tubri.position.copy(this.tubriPos);

    // Pole behind the parapet on the right, with its pulley above the top of the screen's upper third.
    this.poleX = w * 0.38;
    const poleBase = this.ledgeY - h * 0.08;
    this.poleTop = h / 2 - h * 0.1;
    const poleH = (this.poleTop - poleBase) / 0.96;
    const poleW = poleH * aspectOfMesh(this.pole);
    this.pole.scale.set(poleW, poleW, 1);
    this.pole.position.set(this.poleX, poleBase + poleH / 2, -0.6);
    const lw = size * 1.9;
    this.lantern.scale.set(lw, lw, 1);
    this.handle.y0 = this.ledgeY + h * 0.1;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.rope, this.trail]) {
      c.width = Math.round(S.width * dpr);
      c.height = Math.round(S.height * dpr);
    }
  }

  engage(): void {
    if (this.step !== 'idle') return;
    this.skipBtn.hidden = false;
    this.toStep('candles');
  }

  private toStep(step: Step): void {
    this.step = step;
    const c = config.copy.chhad;
    const say = (l: { bn: string; en: string }) => this.overlay.say('step', { bn: l.bn, en: isTouch() ? undefined : l.en }, 'top');
    this.stage.canvas.classList.toggle('carry', step === 'candles' || step === 'sparkler');
    switch (step) {
      case 'candles':
        say(c.candles);
        break;
      case 'lantern':
        say(c.lantern);
        gsap.to(this, { lanternLit: 1, duration: 0.8 });
        break;
      case 'tubri':
        say(c.tubri);
        break;
      case 'sparkler':
        say(c.sparkler);
        break;
      case 'finale':
        this.overlay.hide('step');
        this.overlay.hide('done-btn');
        this.skipBtn.hidden = true;
        this.finale();
        break;
      default:
        break;
    }
  }

  skip(): void {
    if (this.step === 'idle' || this.step === 'finale' || this.step === 'done') return;
    this.candles.setAll(true);
    this.prodips.setAll(true);
    this.lanternLit = 1;
    gsap.to(this, { lanternUp: 1, duration: 1.2, ease: 'power2.inOut' });
    this.toStep('finale');
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
      if (this.step === 'idle' || this.step === 'done') return;
      pos(e);
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.down = true;
      this.pointer.active = true;
      this.stage.canvas.setPointerCapture?.(e.pointerId);
      if (this.step === 'lantern') {
        this.handle.drag = true;
        this.handle.startY = this.pointer.y;
        this.handle.startUp = this.lanternUp;
      }
      if (this.step === 'tubri') {
        const t = this.stage.toScreen(this.tubriPos);
        if (Math.hypot(t.x - this.pointer.x, t.y - this.pointer.y) < Math.max(70, this.stage.width * 0.12)) this.lightTubri();
      }
      if (this.step === 'candles') this.sweepCandles();
    });
    el.addEventListener('pointermove', (e) => {
      if (this.step === 'idle' || this.step === 'done') return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
      if (this.step === 'candles' && this.pointer.active) this.sweepCandles();
      if (this.step === 'lantern' && this.handle.drag) {
        const dy = (this.pointer.y - this.handle.startY) / (this.stage.height * 0.45);
        this.lanternUp = clamp(this.handle.startUp + dy, 0, 1);
        if (this.lanternUp >= 0.98) this.lanternDone();
      }
    });
    const up = (e: PointerEvent) => {
      this.pointer.down = false;
      this.handle.drag = false;
      if (e.pointerType !== 'mouse') this.pointer.active = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private sweepCandles(): void {
    const r = Math.max(22, ((this.stage.width * 0.62) / this.nCandles) * 0.6);
    const { px: x0, py: y0, x: x1, y: y1 } = this.pointer;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    for (const f of [this.candles, this.prodips]) {
      for (let i = 0; i < f.count; i++) {
        if (f.isLit(i)) continue;
        const s = this.stage.toScreen(f.flamePoint(i, this.tmp));
        const t = len2 > 0 ? clamp(((s.x - x0) * dx + (s.y - y0) * dy) / len2, 0, 1) : 0;
        if (Math.hypot(x0 + dx * t - s.x, y0 + dy * t - s.y) < r) f.ignite(i, t * 0.06);
      }
    }
  }

  private onCandle(): void {
    buzz(8);
    if (this.step !== 'candles') return;
    const lit = this.candles.litCount + this.prodips.litCount;
    if (lit >= this.nCandles) gsap.delayedCall(0.9, () => this.step === 'candles' && this.toStep('lantern'));
  }

  private lanternDone(): void {
    if (this.step !== 'lantern') return;
    this.handle.drag = false;
    this.lanternUp = 1;
    buzz([15, 40, 15]);
    gsap.delayedCall(0.8, () => this.toStep('tubri'));
  }

  private lightTubri(): void {
    if (this.step !== 'tubri' || this.tubriOn > 0) return;
    buzz(30);
    this.overlay.hide('step');
    const tl = gsap.timeline();
    tl.to(this, { tubriOn: 1, duration: 0.6, ease: 'power2.out' });
    tl.to(this, { tubriOn: 0, duration: 1.2, ease: 'power1.in' }, config.chhad.tubriSeconds);
    tl.call(() => this.toStep('sparkler'), [], '-=0.6');
  }

  private finale(): void {
    this.doneTimer?.kill();
    const tl = gsap.timeline();
    tl.to(lu(this.cityMat).uMix, { value: 1, duration: 5, ease: 'power1.inOut' }, 0.4);
    tl.to(this.stage, { bloomBoost: 0.35, duration: 2 }, 0.4);
    for (let i = 0; i < 9; i++) tl.call(() => this.launch(), [], 0.8 + i * 0.55 + (i % 3) * 0.15);
    tl.call(() => {
      const c = config.copy.chhad;
      this.overlay.say('finale', { bn: c.finale, en: c.finaleSub }, 'upper', 0, 'greet');
      buzz([30, 70, 30]);
    }, [], 3.2);
    tl.call(() => {
      this.step = 'done';
      this.done = true;
      this.onDone?.();
    }, [], 6.5);
  }

  /** A rocket from behind the rooftops that bursts silently over the city. */
  private launch(): void {
    const { w, h } = this.view;
    const x = (Math.random() - 0.5) * w * 0.8;
    this.rockets.push({ x, y: this.ledgeY, vy: h * 0.75, tY: h * (0.12 + Math.random() * 0.3), color: ROCKET_COLORS[Math.floor(Math.random() * ROCKET_COLORS.length)]!, t: 0 });
  }

  private burst(x: number, y: number, color: Color): void {
    const n = 90;
    const z = -3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const sp = 1.6 + Math.random() * 0.6;
      this.sparks.emit({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random() * 0.6, size: 0.07, color, heat: 3 });
    }
    const k = this.nextFlash++ % 6;
    this.flashes.color(k, color);
    this.flashes.set(k, x, y, z, this.view.w * 0.9, 0);
    this.flashAmp[k] = 0.5;
  }

  private update(dt: number, time: number): void {
    const S = this.stage;
    const { w, h } = this.view;

    // The flame you carry while lighting candles.
    const carrying = this.step === 'candles' && this.pointer.active;
    this.carryAmp += ((carrying ? 1 : 0) - this.carryAmp) * damp(0.08, dt);
    this.carry.master = this.carryAmp;
    if (carrying) this.carry.setPosition(0, S.fromScreen(this.pointer.x, this.pointer.y, 0.2, this.tmp));

    // Akash prodip: rises on its rope.
    const lowY = this.ledgeY + h * 0.06;
    const highY = this.poleTop - h * 0.06;
    const ly = lowY + (highY - lowY) * this.lanternUp;
    this.lantern.position.set(this.poleX - w * 0.012 + Math.sin(time * 1.3) * w * 0.004, ly, -0.5);
    this.lantern.rotation.z = Math.sin(time * 1.1) * 0.04;
    const flick = 1 + 0.06 * Math.sin(time * 8.3) + 0.04 * Math.sin(time * 13.1);
    lu(this.lanternMat).uEmissive.value = this.lanternLit * 0.9 * flick;
    this.lanternLight.set(0, this.lantern.position.x, ly, -0.5, w * 0.5, this.lanternLit * 0.45 * flick);
    this.lanternLight.commit();

    // Tubri fountain.
    if (this.tubriOn > 0.01) {
      const n = Math.round(this.tubriOn * 160 * dt * 10) / 10;
      const top = this.tubriPos.y + this.tubri.scale.y * 0.42 * (1 / aspectOfMesh(this.tubri));
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        const sp = (2.6 + Math.random() * 1.8) * this.tubriOn * (h / 8.3);
        this.sparks.emit({ x: this.tubriPos.x, y: top, z: 0.15, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.6, size: 0.05, color: GOLD, heat: 2.6 });
      }
    }
    this.tubriLight.set(0, this.tubriPos.x, this.tubriPos.y + h * 0.15, 0.1, w * 0.6, this.tubriOn * 0.6 * (0.85 + Math.random() * 0.3));
    this.tubriLight.commit();

    // Rockets rise and burst.
    for (const r of this.rockets) {
      r.t += dt;
      r.y += r.vy * dt;
      r.vy *= Math.exp(-0.9 * dt);
      if (Math.random() < 0.8) this.sparks.emit({ x: r.x, y: r.y, z: -3, vx: 0, vy: -0.2, life: 0.4, size: 0.035, color: GOLD, heat: 2 });
      if (r.y >= r.tY || r.vy < h * 0.1) {
        this.burst(r.x, r.y, r.color);
        r.t = -1;
      }
    }
    this.rockets = this.rockets.filter((r) => r.t >= 0);
    for (let k = 0; k < 6; k++) {
      this.flashAmp[k] = Math.max(0, this.flashAmp[k]! - dt * 0.6);
      this.flashes.amp(k, this.flashAmp[k]!);
    }
    this.flashes.commit();

    // The city warms the parapet a little as it lights up.
    const mix = lu(this.cityMat).uMix.value;
    lu(this.parapetMat).uAmbient.value.setScalar(0.16 + mix * 0.1);

    this.drawRope();
    this.drawTrail(dt, time);
  }

  private drawRope(): void {
    const c = this.ropeCtx;
    const S = this.stage;
    const sx = this.rope.width / S.width;
    c.clearRect(0, 0, this.rope.width, this.rope.height);
    const top = S.toScreen(this.tmp.set(this.poleX, this.poleTop, -0.6));
    const lan = S.toScreen(this.tmp.set(this.lantern.position.x, this.lantern.position.y + this.lantern.scale.y * 0.5 / aspectOfMesh(this.lantern), -0.5));
    // The free end hangs down the pole; pulling it down raises the lantern.
    const endY = S.toScreen(this.tmp.set(0, this.handle.y0 - this.view.h * 0.22 * this.lanternUp, 0)).y;
    const endX = top.x + 10;
    c.strokeStyle = 'rgba(40,28,18,0.9)';
    c.lineWidth = 1.6 * sx;
    c.beginPath();
    c.moveTo(top.x * sx, top.y * sx);
    c.lineTo(lan.x * sx, lan.y * sx);
    c.moveTo(top.x * sx + 6 * sx, top.y * sx);
    c.lineTo(endX * sx, endY * sx);
    c.stroke();
    if (this.step === 'lantern') {
      // The knot you pull, softly pulsing.
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      c.fillStyle = `rgba(255,200,120,${0.5 + 0.3 * pulse})`;
      c.beginPath();
      c.arc(endX * sx, endY * sx, (7 + 3 * pulse) * sx, 0, Math.PI * 2);
      c.fill();
    }
  }

  /** Phuljhuri: a long-exposure trail of light that slowly fades, with sparks off the tip. */
  private drawTrail(dt: number, _time: number): void {
    const c = this.trailCtx;
    const S = this.stage;
    const sx = this.trail.width / S.width;
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = `rgba(0,0,0,${Math.min(1, dt * (this.step === 'sparkler' ? 0.35 : 0.9))})`;
    c.fillRect(0, 0, this.trail.width, this.trail.height);
    c.globalCompositeOperation = 'lighter';
    if (this.step !== 'sparkler' || !this.pointer.active) {
      this.lastInk = null;
      return;
    }
    const { x, y } = this.pointer;
    const last = this.lastInk ?? { x, y };
    const seg = Math.hypot(x - last.x, y - last.y);
    if (seg > 0.5) {
      c.lineCap = 'round';
      c.shadowColor = 'rgba(255,190,90,0.9)';
      c.shadowBlur = 14 * sx;
      c.strokeStyle = 'rgba(255,214,150,0.9)';
      c.lineWidth = 3.2 * sx;
      c.beginPath();
      c.moveTo(last.x * sx, last.y * sx);
      c.lineTo(x * sx, y * sx);
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,240,0.9)';
      c.lineWidth = 1.2 * sx;
      c.stroke();
      this.ink += seg / S.height;
    }
    this.lastInk = { x, y };
    const w = S.fromScreen(x, y, 0.5, this.tmp);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 1.4;
      this.sparks.emit({ x: w.x, y: w.y, z: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.25 + Math.random() * 0.35, size: 0.03, color: GOLD, heat: 3 });
    }
    if (this.ink > config.chhad.sparklerInk && !this.doneTimer) {
      this.overlay.buttons('done-btn', [{ label: 'Done', primary: true, onClick: () => this.toStep('finale') }], 'bottom');
      this.doneTimer = gsap.delayedCall(14, () => this.step === 'sparkler' && this.toStep('finale'));
    }
  }
}

function aspectOfMesh(m: Mesh): number {
  return 1 / (m.geometry as PlaneGeometry).parameters.height;
}

