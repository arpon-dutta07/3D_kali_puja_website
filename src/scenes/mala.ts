import { gsap } from 'gsap';
import { createNoise2D } from 'simplex-noise';
import { Group, Mesh, PlaneGeometry, Vector2, Vector3, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { CameraRig, fitShot, type Shot } from '../gl/camera';
import { Glows } from '../gl/glows';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadSeries } from '../lib/assets';
import { buzz, damp, isTouch } from '../lib/device';
import type { Chapter } from '../journey';
import { cornerButton, Overlay } from '../ui/overlay';

interface Flower {
  mesh: Mesh;
  mat: ShaderMaterial;
  home: Vector2;
  angle: number;
  spin: number;
  /** -1 while floating, otherwise its place on the thread. */
  slot: number;
  /** 0 floating → 1 on the thread (animated). */
  t: number;
  from: Vector3;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
}

/**
 * জবার মালা: red hibiscus float in a brass thala. Pull the needle through them and they slide onto the thread one by
 * one; when the last is on, the garland is lifted away and Ma is seen wearing it.
 */
export class Mala implements Chapter {
  readonly stage: Stage;
  readonly overlay: Overlay;
  done = false;
  onDone: (() => void) | null = null;
  private rig: CameraRig;
  private thala = new Group();
  private maGroup = new Group();
  private flowers: Flower[] = [];
  private R = 1.5;
  private T = 4;
  private rope: Vector3[] = [];
  private seg = 0.03;
  private tip = new Vector3();
  private dir = new Vector2(-0.7, 0.7);
  private next = 0;
  private engaged = false;
  private finished = false;
  private pointer = { x: 0, y: 0, down: false, active: false, moved: 0 };
  private ripples: Ripple[] = [];
  private wakeTimer = 0;
  private idle = 0;
  private assist: gsap.core.Tween | null = null;
  private noise = createNoise2D();
  private canvas2d: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private shots: { thala: Shot; ma: Shot } = {} as never;
  private lift = 0;
  private skipBtn: HTMLButtonElement;
  private fade: HTMLDivElement;
  private maMat!: ShaderMaterial;
  private maLamps!: LampField;
  private lampLight!: Glows;
  private tmp = new Vector3();

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 35 });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.06;
    this.canvas2d = document.createElement('canvas');
    this.canvas2d.className = 'thread';
    section.appendChild(this.canvas2d);
    this.ctx = this.canvas2d.getContext('2d')!;
    this.overlay = new Overlay(section);
    this.skipBtn = cornerButton(this.overlay.root, config.copy.ui.skip, () => this.skip());
    this.skipBtn.hidden = true;
    this.fade = document.createElement('div');
    this.fade.className = 'fade';
    section.appendChild(this.fade);
  }

  async init(): Promise<void> {
    const S = this.stage;
    const [thalaArt, maArt, bowlArt] = await Promise.all([
      artOr('mala/thala.webp', ph.thala),
      artOr('intro/ma-mala.webp', () => ph.maStandIn(true)),
      artOr('common/prodip.webp', ph.prodipBowl),
    ]);
    let jaba: Texture[] = await loadSeries('mala/jaba', 4);
    if (!jaba.length) jaba = [0, 1, 2, 3].map((i) => ph.jaba(i));

    // A dark floor so the cloth's edge never meets plain black.
    const floorMat = litMaterial(S, ph.stone(), { ambient: 0.05, gain: 0.5, transparent: false, repeat: [8, 8] });
    const floor = new Mesh(new PlaneGeometry(40, 40), floorMat);
    floor.position.z = -0.02;
    this.thala.add(floor);
    const thalaMat = litMaterial(S, thalaArt.tex, { ambient: 0.3, gain: 1.0, transparent: false });
    const thala = new Mesh(new PlaneGeometry(this.T, this.T), thalaMat);
    this.thala.add(thala);
    // The water is about 76% of the picture's width (see the thala prompt).
    this.R = this.T * 0.36;
    S.scene.add(this.thala);

    // One oil lamp just outside the frame on the left lights the thala, as in the picture.
    this.lampLight = new Glows(2, S.lightScene);
    this.lampLight.color(0, config.palette.amber);
    this.lampLight.color(1, '#ffcf9a');
    this.lampLight.set(0, -this.T * 0.62, this.T * 0.05, 0.1, this.T * 1.7, 0.9);
    this.lampLight.set(1, 0, 0, 0.1, this.T * 1.3, 0.18);
    this.lampLight.commit();

    const n = config.mala.flowers;
    const size = this.T * config.mala.flowerSize;
    // Spread on the water like they were dropped in: random but never overlapping (seeded, same every visit).
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const homes: Vector2[] = [];
    for (let tries = 0; homes.length < n && tries < 20000; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (this.R - size * 0.56);
      const p = new Vector2(Math.cos(a) * r, Math.sin(a) * r);
      if (homes.every((h) => h.distanceTo(p) > size * 1.02)) homes.push(p);
    }
    for (let i = 0; i < homes.length; i++) {
      const home = homes[i]!;
      const tex = jaba[i % jaba.length]!;
      const mat = litMaterial(S, tex, { ambient: 0.32, gain: 1.0 });
      const mesh = new Mesh(new PlaneGeometry(size, size / aspectOf(tex)), mat);
      mesh.position.set(home.x, home.y, 0.02 + i * 0.001);
      mesh.renderOrder = 10;
      this.thala.add(mesh);
      this.flowers.push({ mesh, mat, home, angle: rnd() * 6.28, spin: (rnd() - 0.5) * 0.15, slot: -1, t: 0, from: new Vector3() });
    }

    // Thread: rests coiled off the bottom-right of the thala, needle pointing in.
    const N = config.mala.ropeSegments;
    this.seg = (this.T * 2.2) / N;
    this.tip.set(this.R * 0.95, -this.R * 0.95, 0.06);
    for (let k = 0; k < N; k++) {
      this.rope.push(new Vector3(this.tip.x + 0.25 + k * this.seg * 0.7, this.tip.y - 0.1 - Math.sin(k * 0.05) * 0.4, 0.06));
    }

    // Ma wearing the garland, far to the side; the camera cuts to her at the end.
    this.maGroup.position.set(40, 0, 0);
    const maH = 4;
    this.maMat = litMaterial(S, maArt.tex, { ambient: 0.05, gain: 0.8 });
    const ma = new Mesh(new PlaneGeometry(maH * aspectOf(maArt.tex), maH), this.maMat);
    ma.position.y = maH / 2;
    this.maGroup.add(ma);
    S.scene.add(this.maGroup);
    const bowlAspect = aspectOf(bowlArt.tex);
    const lampSize = 0.55;
    this.maLamps = new LampField(
      S,
      [new Vector3(40 - 1.5, lampSize / bowlAspect * 0.4, 0.6), new Vector3(40 + 1.5, lampSize / bowlAspect * 0.4, 0.6)],
      lampSize,
      { bowl: bowlArt.tex, bowlAspect, light: 8, lightAmp: 0.55 },
    );
    lu(this.maMat).uRise.value = -0.2;

    S.onResize(() => this.computeShots());
    S.onFrame((dt, time) => this.update(dt, time));
    this.bindInput();
    this.rig.snap(this.shots.thala);
  }

  private computeShots(): void {
    const S = this.stage;
    const r = this.R * 1.18;
    this.shots.thala = fitShot(
      S,
      [new Vector3(-r, 0, 0), new Vector3(r, 0, 0), new Vector3(0, -r, 0), new Vector3(0, r, 0)],
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 1),
      { x: 0.94, y: 0.78 },
    );
    const mx = 40;
    this.shots.ma = fitShot(
      S,
      [new Vector3(mx - 1.6, 0, 0), new Vector3(mx + 1.6, 0, 0), new Vector3(mx, 4.1, 0), new Vector3(mx, -0.1, 0)],
      new Vector3(mx, 2.1, 0),
      new Vector3(0, 0.05, 1),
      { x: 0.86, y: 0.72 },
    );
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas2d.width = Math.round(S.width * dpr);
    this.canvas2d.height = Math.round(S.height * dpr);
    if (this.finished) this.rig.snap(this.shots.ma);
  }

  engage(): void {
    if (this.engaged || this.done) return;
    this.engaged = true;
    const i = config.copy.mala.invite;
    this.overlay.say('invite', { bn: i.bn, en: isTouch() ? undefined : i.en }, 'top');
    this.skipBtn.hidden = false;
    this.idle = 0;
    this.stage.canvas.classList.add('carry');
  }

  skip(): void {
    if (this.finished) return;
    for (const f of this.flowers) if (f.slot < 0) this.thread(f, true);
  }

  private bindInput(): void {
    const el = this.section;
    const pos = (e: PointerEvent) => {
      const r = this.stage.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged || this.finished) return;
      pos(e);
      this.pointer.down = true;
      this.pointer.active = true;
      this.assist?.kill();
      this.stage.canvas.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.engaged || this.finished) return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
      if (this.pointer.active) this.pointer.moved += 1;
    });
    const up = (e: PointerEvent) => {
      this.pointer.down = false;
      if (e.pointerType !== 'mouse') this.pointer.active = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private thread(f: Flower, quick = false): void {
    if (f.slot >= 0) return;
    f.slot = this.next++;
    f.from.copy(f.mesh.position);
    this.ripples.push({ x: f.mesh.position.x, y: f.mesh.position.y, age: 0, life: 1.6, size: this.T * 0.16 });
    this.ripples.push({ x: f.mesh.position.x, y: f.mesh.position.y, age: -0.25, life: 1.6, size: this.T * 0.12 });
    buzz(12);
    this.idle = 0;
    gsap.to(f, { t: 1, duration: quick ? 0.5 : 0.45, ease: 'power2.out', delay: quick ? f.slot * 0.08 : 0 });
    if (this.next === 1) this.overlay.hide('invite');
    if (this.next >= this.flowers.length) gsap.delayedCall(quick ? 1.4 : 0.9, () => this.complete());
  }

  /** Index on the rope where flower `slot` hangs. */
  private slotIndex(slot: number): number {
    return 14 + slot * 12;
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    this.skipBtn.hidden = true;
    this.stage.canvas.classList.remove('carry');
    buzz([20, 60, 20]);
    const tl = gsap.timeline();
    // The garland is lifted up and away, as if carried to Ma.
    tl.to(this, { lift: 1, duration: 1.8, ease: 'power2.in' }, 0.2);
    tl.to(this.fade, { opacity: 1, duration: 0.7, ease: 'power1.in' }, 1.4);
    tl.call(() => {
      this.rig.snap(this.shots.ma);
      this.thala.visible = false;
      this.maLamps.setAll(true, true);
    });
    tl.to(this.fade, { opacity: 0, duration: 1.2, ease: 'power1.out' });
    tl.to(lu(this.maMat).uRise, { value: 1.2, duration: 3.2, ease: 'power1.inOut' }, '<');
    tl.to(lu(this.maMat).uRiseGain, { value: 0.95, duration: 1.2 }, '<');
    tl.call(() => this.overlay.say('done', config.copy.mala.done, 'bottom'), [], '-=1.4');
    tl.call(() => {
      this.done = true;
      this.onDone?.();
    }, [], '+=0.6');
  }

  private update(dt: number, time: number): void {
    const S = this.stage;
    // Needle tip: follows the pointer (or the assist) with a little lag, so it feels like a real needle in water.
    if (this.engaged && !this.finished) {
      this.idle += dt;
      if (this.idle > 6 && !this.pointer.active && !this.assist?.isActive()) this.runAssist();
      if (this.pointer.active) {
        const target = S.fromScreen(this.pointer.x, this.pointer.y, 0.06, this.tmp);
        const k = damp(0.04, dt);
        const dx = (target.x - this.tip.x) * k;
        const dy = (target.y - this.tip.y) * k;
        this.tip.x += dx;
        this.tip.y += dy;
        if (Math.hypot(dx, dy) > 0.002) this.dir.lerp(new Vector2(dx, dy).normalize(), 0.25).normalize();
      }
      // Pass through a flower to thread it.
      const catchR = this.T * config.mala.flowerSize * 0.5 * config.mala.needleCatch;
      for (const f of this.flowers) {
        if (f.slot >= 0) continue;
        if (Math.hypot(f.mesh.position.x - this.tip.x, f.mesh.position.y - this.tip.y) < catchR) this.thread(f);
      }
      // A faint wake behind the needle in the water.
      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0 && Math.hypot(this.tip.x, this.tip.y) < this.R && this.pointer.active) {
        this.wakeTimer = 0.16;
        this.ripples.push({ x: this.tip.x, y: this.tip.y, age: 0, life: 0.9, size: this.T * 0.05 });
      }
    }

    // Rope: the eye of the needle leads, every segment follows the one before at a fixed length.
    const needleLen = this.T * 0.075;
    const eye = this.rope[0]!;
    eye.set(this.tip.x - this.dir.x * needleLen, this.tip.y - this.dir.y * needleLen, 0.06);
    for (let k = 1; k < this.rope.length; k++) {
      const a = this.rope[k - 1]!;
      const b = this.rope[k]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > this.seg) {
        b.x = a.x + (dx / d) * this.seg;
        b.y = a.y + (dy / d) * this.seg;
      }
    }

    // Flowers: drift on the water, or ride the thread.
    const liftY = this.lift * this.lift * this.T * 1.6;
    for (const [i, f] of this.flowers.entries()) {
      f.angle += f.spin * dt;
      if (f.slot < 0) {
        const nx = this.noise(time * 0.07, i * 3.1) * this.R * 0.12;
        const ny = this.noise(i * 5.7, time * 0.07) * this.R * 0.12;
        f.mesh.position.set(f.home.x + nx, f.home.y + ny, 0.02 + i * 0.001);
        f.mesh.rotation.z = f.angle;
        f.mesh.scale.setScalar(1 + Math.sin(time * 1.3 + i) * 0.015);
      } else {
        const idx = Math.min(this.rope.length - 2, this.slotIndex(f.slot));
        const p = this.rope[idx]!;
        const q = this.rope[idx + 1]!;
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        const t = f.t;
        f.mesh.position.set(
          f.from.x + (p.x - f.from.x) * t,
          f.from.y + (p.y - f.from.y) * t + liftY,
          0.05 + f.slot * 0.001,
        );
        f.mesh.rotation.z = f.angle * (1 - t) + ang * t;
        f.mesh.scale.setScalar(1 - 0.18 * t);
      }
    }
    this.lampLight.amp(0, 0.9 * (1 + 0.08 * Math.sin(time * 9) + 0.05 * Math.sin(time * 5.3)));
    this.lampLight.commit();
    this.drawThread(dt, liftY);
  }

  private runAssist(): void {
    const free = this.flowers.filter((f) => f.slot < 0);
    if (!free.length) return;
    free.sort((a, b) => a.mesh.position.distanceTo(this.tip) - b.mesh.position.distanceTo(this.tip));
    const f = free[0]!;
    const from = this.tip.clone();
    const to = f.mesh.position.clone();
    const over = to.clone().add(to.clone().sub(from).setLength(this.T * 0.08));
    this.assist = gsap.to(this.tip, {
      x: over.x,
      y: over.y,
      duration: 1.3,
      ease: 'sine.inOut',
      onUpdate: () => {
        const d = new Vector2(over.x - from.x, over.y - from.y).normalize();
        this.dir.lerp(d, 0.2).normalize();
      },
      onComplete: () => {
        this.idle = 0;
      },
    });
  }

  /** Thread, needle and ripples on a 2D canvas over the scene. */
  private drawThread(dt: number, liftY: number): void {
    const c = this.ctx;
    const S = this.stage;
    const W = this.canvas2d.width;
    const H = this.canvas2d.height;
    const sx = W / S.width;
    c.clearRect(0, 0, W, H);
    if (!this.thala.visible) return;
    const pts = this.rope.map((p) => {
      this.tmp.set(p.x, p.y + (this.finished ? liftY : 0), p.z).project(S.camera);
      return { x: (this.tmp.x * 0.5 + 0.5) * W, y: (0.5 - this.tmp.y * 0.5) * H };
    });

    // Ripples under everything.
    this.ripples = this.ripples.filter((r) => (r.age += dt) < r.life);
    for (const r of this.ripples) {
      if (r.age < 0) continue;
      const t = r.age / r.life;
      this.tmp.set(r.x, r.y, 0.03).project(S.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * W;
      const y = (0.5 - this.tmp.y * 0.5) * H;
      const rad = this.worldToPx(r.size * (0.25 + t)) * sx;
      c.strokeStyle = `rgba(255,230,190,${0.22 * (1 - t)})`;
      c.lineWidth = 1.5 * sx;
      c.beginPath();
      c.ellipse(x, y, rad, rad, 0, 0, Math.PI * 2);
      c.stroke();
    }

    // Thread: a dark core with a warm highlight.
    const last = this.next > 0 ? Math.min(pts.length, this.slotIndex(this.next - 1) + 40) : 60;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [w, col] of [
      [3.2, 'rgba(60,4,10,0.9)'],
      [1.6, 'rgba(210,40,50,0.95)'],
    ] as const) {
      c.strokeStyle = col;
      c.lineWidth = w * sx;
      c.beginPath();
      for (let k = 0; k < last; k++) {
        const p = pts[k]!;
        if (k === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      c.stroke();
    }

    // Needle: a thin steel line from the eye to the tip, with a glint.
    if (!this.finished) {
      this.tmp.copy(this.tip).project(S.camera);
      const tx = (this.tmp.x * 0.5 + 0.5) * W;
      const ty = (0.5 - this.tmp.y * 0.5) * H;
      const e = pts[0]!;
      const g = c.createLinearGradient(e.x, e.y, tx, ty);
      g.addColorStop(0, '#8a8f96');
      g.addColorStop(0.6, '#e6ebf0');
      g.addColorStop(1, '#ffffff');
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 3.4 * sx;
      c.beginPath();
      c.moveTo(e.x + 2 * sx, e.y + 3 * sx);
      c.lineTo(tx + 2 * sx, ty + 3 * sx);
      c.stroke();
      c.strokeStyle = g;
      c.lineWidth = 2.4 * sx;
      c.beginPath();
      c.moveTo(e.x, e.y);
      c.lineTo(tx, ty);
      c.stroke();
      c.strokeStyle = 'rgba(40,40,44,0.9)';
      c.lineWidth = 1 * sx;
      c.beginPath();
      c.ellipse(e.x, e.y, 2.6 * sx, 1.4 * sx, Math.atan2(ty - e.y, tx - e.x), 0, Math.PI * 2);
      c.stroke();
    }
  }

  /** Approximate pixels for a world length on the thala plane. */
  private worldToPx(len: number): number {
    const a = new Vector3(0, 0, 0).project(this.stage.camera);
    const b = new Vector3(len, 0, 0).project(this.stage.camera);
    return Math.abs(b.x - a.x) * 0.5 * this.stage.width;
  }
}
