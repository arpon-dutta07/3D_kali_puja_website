import { gsap } from 'gsap';
import { createNoise2D } from 'simplex-noise';
import { Group, Mesh, PlaneGeometry, RepeatWrapping, Vector2, Vector3, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { CameraRig, fitShot, type Shot } from '../gl/camera';
import { Glows } from '../gl/glows';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadSeries, loadTexture } from '../lib/assets';
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
  /** Where on the rope it rides now (eases back as newer flowers come in front of it). */
  idx: number;
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
  /** Centre of the water (the generated thala isn't exactly in the middle of its picture). */
  private C = new Vector2();
  private T = 4;
  private rope: Vector3[] = [];
  private seg = 0.03;
  private tip = new Vector3();
  private dir = new Vector2(-0.7, 0.7);
  private next = 0;
  private engaged = false;
  private finished = false;
  private pointer = { x: 0, y: 0, down: false, active: false, moved: 0 };
  /** Where the needle is heading (it keeps gliding there after a tap). */
  private target: Vector3 | null = null;
  private glide = 0.04;
  private flowerSize = 0.5;
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
  private backMat!: ShaderMaterial;
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
    const [sceneTex, thalaArt, maArt, bowlArt, stoneArt, shrineArt] = await Promise.all([
      loadTexture('mala/thala-scene.webp'),
      artOr('mala/thala.webp', ph.thala),
      artOr('intro/ma-mala.webp', () => ph.maStandIn(true)),
      artOr('common/prodip.webp', ph.prodipBowl),
      artOr('intro/stone.webp', ph.stone),
      artOr('intro/shrine.webp', ph.shrine),
    ]);
    let jaba: Texture[] = await loadSeries('mala/jaba', 4);
    if (!jaba.length) jaba = [0, 1, 2, 3].map((i) => ph.jaba(i));

    // A dark floor so the cloth's edge never meets plain black.
    stoneArt.tex.wrapS = stoneArt.tex.wrapT = RepeatWrapping;
    const floorMat = litMaterial(S, stoneArt.tex, { ambient: 0.025, gain: 0.45, transparent: false, repeat: [10, 10] });
    const floor = new Mesh(new PlaneGeometry(40, 40), floorMat);
    floor.position.z = -0.02;
    this.thala.add(floor);
    // The full-bleed thala (round 2) is a much bigger picture with the thala small in its middle, so any screen can
    // crop it; the first thala picture is the fallback.
    const full = config.mala.scene;
    if (sceneTex) this.T = 4 / (full.r / 0.31);
    const thalaMat = litMaterial(S, sceneTex ?? thalaArt.tex, { ambient: 0.3, gain: 1.0, transparent: false });
    const thala = new Mesh(new PlaneGeometry(this.T, this.T), thalaMat);
    this.thala.add(thala);
    if (sceneTex) {
      this.R = this.T * full.r;
      this.C.set((full.cx - 0.5) * this.T, (0.5 - full.cy) * this.T);
    } else if (thalaArt.real) {
      // Measured on the first generated thala: water centred at (0.505, 0.49), radius 0.31 of its width.
      this.R = this.T * 0.31;
      this.C.set(this.T * 0.005, this.T * 0.01);
    } else {
      this.R = this.T * 0.36;
    }
    S.scene.add(this.thala);

    // One oil lamp just outside the frame on the left lights the thala, as in the picture.
    this.lampLight = new Glows(2, S.lightScene);
    this.lampLight.color(0, config.palette.amber);
    this.lampLight.color(1, '#ffcf9a');
    // On the generated picture the lamp stands in the top-left corner.
    if (sceneTex) this.lampLight.set(0, (full.lampU - 0.5) * this.T, (0.5 - full.lampV) * this.T, 0.1, this.R * 5.5, 0.9);
    else if (thalaArt.real) this.lampLight.set(0, -this.T * 0.47, this.T * 0.42, 0.1, this.T * 1.9, 0.9);
    else this.lampLight.set(0, -this.T * 0.62, this.T * 0.05, 0.1, this.T * 1.7, 0.9);
    this.lampLight.set(1, this.C.x, this.C.y, 0.1, this.R * 4, 0.18);
    this.lampLight.commit();

    const n = config.mala.flowers;
    const size = this.R * config.mala.flowerSize * (4 / 1.24);
    this.flowerSize = size;
    // Spread on the water like they were dropped in: random but never overlapping (seeded, same every visit).
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const homes: Vector2[] = [];
    for (let tries = 0; homes.length < n && tries < 20000; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (this.R - size * 0.56);
      const p = new Vector2(this.C.x + Math.cos(a) * r, this.C.y + Math.sin(a) * r);
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
      this.flowers.push({ mesh, mat, home, angle: rnd() * 6.28, spin: (rnd() - 0.5) * 0.15, slot: -1, t: 0, from: new Vector3(), idx: 0 });
    }

    // Thread: rests coiled off the bottom-right of the thala, needle pointing in.
    const N = config.mala.ropeSegments;
    this.seg = (this.R * 7) / N;
    this.tip.set(this.C.x + this.R * 0.95, this.C.y - this.R * 0.95, 0.06);
    for (let k = 0; k < N; k++) {
      this.rope.push(new Vector3(this.tip.x + 0.25 + k * this.seg * 0.7, this.tip.y - 0.1 - Math.sin(k * 0.05) * 0.4, 0.06));
    }

    // Ma wearing the garland, far to the side; the camera cuts to her at the end.
    this.maGroup.position.set(40, 0, 0);
    const maH = 4;
    // The same shrine wall as the opening, dim, behind her.
    this.backMat = litMaterial(S, shrineArt.tex, { ambient: 0.02, gain: 0.45, transparent: false });
    lu(this.backMat).uRiseColor.value.set('#7a3a1c');
    const backW = 16;
    const back = new Mesh(new PlaneGeometry(backW, backW / aspectOf(shrineArt.tex)), this.backMat);
    back.position.set(0, maH * 0.62, -2.4);
    this.maGroup.add(back);
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
      { bowl: bowlArt.tex, bowlAspect, ...(bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder), light: 8, lightAmp: 0.55 },
    );
    lu(this.maMat).uRise.value = -0.2;

    S.onResize(() => this.computeShots());
    S.onFrame((dt, time) => this.update(dt, time));
    this.bindInput();
    this.rig.snap(this.shots.thala);
  }

  private computeShots(): void {
    const S = this.stage;
    const r = this.R * 1.25;
    const { x: cx, y: cy } = this.C;
    this.shots.thala = fitShot(
      S,
      [new Vector3(cx - r, cy, 0), new Vector3(cx + r, cy, 0), new Vector3(cx, cy - r, 0), new Vector3(cx, cy + r, 0)],
      new Vector3(cx, cy, 0),
      new Vector3(0, 0, 1),
      { x: 0.94, y: 0.78 },
    );
    const mx = 40;
    this.shots.ma = fitShot(
      S,
      [new Vector3(mx - 1.6, 0, 0), new Vector3(mx + 1.6, 0, 0), new Vector3(mx, 4.1, 0), new Vector3(mx, -0.1, 0)],
      // Centred a little low so Ma sits higher and the line below her has room.
      new Vector3(mx, 1.65, 0),
      new Vector3(0, 0.05, 1),
      { x: 0.86, y: 0.82 },
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
    this.overlay.say('invite', isTouch() ? { bn: config.copy.mala.inviteTouch } : i, 'top');
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
    // A finger taps (the needle glides there) or sweeps sideways; vertical swipes stay with the page.
    const aim = (e: PointerEvent) => {
      this.target = this.stage.fromScreen(this.pointer.x, this.pointer.y, 0.06, new Vector3());
      this.glide = e.pointerType === 'mouse' ? 0.04 : 0.1;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged || this.finished) return;
      pos(e);
      this.pointer.down = true;
      this.pointer.active = true;
      this.assist?.kill();
      aim(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.engaged || this.finished) return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
      if (this.pointer.active) {
        this.pointer.moved += 1;
        aim(e);
      }
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
    // The newest flower sits nearest the needle; the ones before it are pushed back along the thread.
    f.idx = this.slotIndex(0);
    this.ripples.push({ x: f.mesh.position.x, y: f.mesh.position.y, age: 0, life: 1.6, size: this.R * 0.52 });
    this.ripples.push({ x: f.mesh.position.x, y: f.mesh.position.y, age: -0.25, life: 1.6, size: this.R * 0.39 });
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
    tl.to(lu(this.backMat).uRise, { value: 0.7, duration: 3.2, ease: 'power1.inOut' }, '<');
    tl.to(lu(this.backMat).uRiseGain, { value: 0.35, duration: 1.2 }, '<');
    tl.call(() => this.overlay.say('done', config.copy.mala.done, 'bottom'), [], '-=1.4');
    tl.call(() => {
      this.done = true;
      this.onDone?.();
    }, [], '+=0.6');
  }

  private update(dt: number, time: number): void {
    // Needle tip: follows the pointer (or the assist) with a little lag, so it feels like a real needle in water.
    if (this.engaged && !this.finished) {
      this.idle += dt;
      if (this.idle > 6 && !this.pointer.active && !this.assist?.isActive()) this.runAssist();
      if (this.target && !this.assist?.isActive()) {
        const k = damp(this.glide, dt);
        const dx = (this.target.x - this.tip.x) * k;
        const dy = (this.target.y - this.tip.y) * k;
        this.tip.x += dx;
        this.tip.y += dy;
        if (Math.hypot(dx, dy) > 0.002) this.dir.lerp(new Vector2(dx, dy).normalize(), 0.25).normalize();
      }
      // Pass through a flower to thread it.
      const catchR = this.flowerSize * 0.5 * config.mala.needleCatch;
      for (const f of this.flowers) {
        if (f.slot >= 0) continue;
        if (Math.hypot(f.mesh.position.x - this.tip.x, f.mesh.position.y - this.tip.y) < catchR) this.thread(f);
      }
      // A faint wake behind the needle in the water.
      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0 && Math.hypot(this.tip.x - this.C.x, this.tip.y - this.C.y) < this.R && this.pointer.active) {
        this.wakeTimer = 0.16;
        this.ripples.push({ x: this.tip.x, y: this.tip.y, age: 0, life: 0.9, size: this.R * 0.16 });
      }
    }

    // Rope: the eye of the needle leads, every segment follows the one before at a fixed length.
    const needleLen = this.R * 0.24;
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
    const liftY = this.lift * this.lift * this.R * 5.2;
    for (const [i, f] of this.flowers.entries()) {
      f.angle += f.spin * dt;
      if (f.slot < 0) {
        const nx = this.noise(time * 0.07, i * 3.1) * this.R * 0.12;
        const ny = this.noise(i * 5.7, time * 0.07) * this.R * 0.12;
        f.mesh.position.set(f.home.x + nx, f.home.y + ny, 0.02 + i * 0.001);
        f.mesh.rotation.z = f.angle;
        f.mesh.scale.setScalar(1 + Math.sin(time * 1.3 + i) * 0.015);
      } else {
        f.idx += (this.slotIndex(this.next - 1 - f.slot) - f.idx) * damp(0.12, dt);
        const fi = Math.min(this.rope.length - 2.001, f.idx);
        const i0 = Math.floor(fi);
        const p = this.tmp.copy(this.rope[i0]!).lerp(this.rope[i0 + 1]!, fi - i0);
        const q = this.rope[Math.min(this.rope.length - 1, i0 + 2)]!;
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
    const over = to.clone().add(to.clone().sub(from).setLength(this.R * 0.26));
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
        this.target = null;
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
