import { gsap } from 'gsap';
import {
  BoxGeometry,
  Color,
  Mesh,
  PlaneGeometry,
  Plane,
  Raycaster,
  RepeatWrapping,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { config } from '../config';
import { CameraRig, fitShot, type Shot } from '../gl/camera';
import { Glows } from '../gl/glows';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Sparks } from '../gl/sparks';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadSeries, loadTexture } from '../lib/assets';
import { bn, buzz, damp, isTouch } from '../lib/device';
import { parallax } from '../lib/parallax';
import { cornerButton, counter, Overlay } from '../ui/overlay';

type State = 'loading' | 'gate' | 'dark' | 'lighting' | 'finishing' | 'midnight' | 'blessing';

interface Layout {
  rows: number;
  perRow: number;
  width: number;
  rise: number;
  tread: number;
  top: number;
  maZ: number;
  maH: number;
  maW: number;
  maBase: number;
  /** Half-width of everything that stands beside Ma (for framing the blessing). */
  sideHalf: number;
}

interface Decor {
  mesh: Mesh;
  mat: ShaderMaterial;
  /** Lamp trees light up at midnight; the rest is lit by the lamps and the halo. */
  glow: boolean;
}

/** Hand-drawn flame for the gate button (no emoji). */
const FLAME_ICON = `<svg viewBox="0 0 24 32" aria-hidden="true"><defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a2a"/><stop offset=".55" stop-color="#ffb347"/><stop offset="1" stop-color="#fff2c8"/></linearGradient></defs><path d="M12 1C14 7 20 10 20 18a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 5 3 6-1-5 0-10 1-15z" fill="url(#fl)"/><path d="M12 14c1.5 2.5 3.5 3.5 3.5 6.5a3.5 3.5 0 0 1-7 0c0-2 1-3 2-4 .2 1.2.8 2 1.6 2.4-.4-1.8-.4-3.4-.1-4.9z" fill="#fff6dc"/></svg>`;

/**
 * Opening: অমাবস্যার ১০৮ প্রদীপ. A new-moon gate, then one prodip; carry its flame across 108 lamps on the temple
 * steps and the light climbs Ma from her feet to her face. At midnight the lamp trees beside her catch and she is
 * fully seen, with nothing written over her.
 */
export class Intro {
  readonly stage: Stage;
  readonly overlay: Overlay;
  state: State = 'loading';
  private rig: CameraRig;
  private lay!: Layout;
  private lamps!: LampField;
  private first!: LampField;
  private carry!: LampField;
  private ma!: Mesh;
  private maMat!: ShaderMaterial;
  private backMat!: ShaderMaterial;
  private stepMat!: ShaderMaterial;
  private halo!: Glows;
  private treeLights!: Glows;
  private decor: Decor[] = [];
  private embers!: Sparks;
  private petalTex: Texture[] = [];
  private petals: Array<{ s: Sprite; vy: number; ph: number; spin: number; x0: number }> = [];
  private shots: Record<'gate' | 'steps' | 'ma' | 'blessing', Shot> = {} as never;
  private screenPos: Array<{ x: number; y: number }> = [];
  private pointer = { x: 0, y: 0, px: 0, py: 0, down: false, inside: false };
  private carrying = false;
  private carryAmp = 0;
  private rise = 0;
  private riseTarget = 0;
  private haloAmp = 0;
  private treeAmp = 0;
  private idle = 0;
  private assist: gsap.core.Tween | null = null;
  private ghost: { x: number; y: number } | null = null;
  private counterEl: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private gate: HTMLElement;
  private raycaster = new Raycaster();
  private stepsPlane = new Plane();
  private keyHeld = false;

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 42 });
    this.overlay = new Overlay(section);
    this.rig = new CameraRig(this.stage);
    this.counterEl = counter(this.overlay.root);
    this.skipBtn = cornerButton(this.overlay.root, config.copy.ui.skip, () => this.skip());
    this.skipBtn.hidden = true;
    this.gate = this.buildGate();
  }

  /** The new-moon gate: a black disc with a slowly turning corona, the title inside it, one button below. */
  private buildGate(): HTMLElement {
    const g = config.copy.gate;
    const el = document.createElement('div');
    el.className = 'gate';
    el.innerHTML = `
      <div class="moon" aria-hidden="true"><div class="corona"></div><div class="corona two"></div><div class="disc"></div><div class="rim"></div></div>
      <div class="gate-copy">
        <p class="kicker">${g.kicker}</p>
        <h1 class="title">${g.title}</h1>
        <p class="sub">${g.sub}</p>
      </div>
      <button type="button" class="btn primary light-btn">${FLAME_ICON}<span>${g.button.bn}</span><small>${g.button.en}</small></button>`;
    el.querySelector('button')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.lightFirst();
    });
    this.section.appendChild(el);
    return el;
  }

  async init(): Promise<void> {
    const portrait = this.stage.aspect < 1;
    const c = config.intro;
    const rows = portrait ? c.rowsPortrait : c.rowsLandscape;
    const [maArt, backArt, stoneArt, bowlArt] = await Promise.all([
      artOr('intro/ma.webp', () => ph.maStandIn()),
      artOr('intro/shrine.webp', ph.shrine),
      artOr('intro/stone.webp', ph.stone),
      artOr('common/prodip.webp', ph.prodipBowl),
    ]);
    this.petalTex = await loadSeries('common/petal', 4);

    const maH = c.maHeight * (portrait ? 0.9 : 1);
    const tread = portrait ? c.tread * 0.8 : c.tread;
    const top = rows * c.rise;
    const maW = maH * aspectOf(maArt.tex);
    this.lay = {
      rows,
      perRow: c.count / rows,
      width: portrait ? c.widthPortrait : c.widthLandscape,
      rise: c.rise,
      tread,
      top,
      maZ: -rows * tread - 1.0,
      maH,
      maW,
      maBase: top + 0.22,
      sideHalf: maW / 2,
    };
    const L = this.lay;
    const S = this.stage;

    // Shrine wall far behind.
    const backAspect = aspectOf(backArt.tex);
    const backW = Math.max(34, L.width * 2.4);
    this.backMat = litMaterial(S, backArt.tex, { ambient: 0.018, gain: 0.35, transparent: false });
    lu(this.backMat).uRiseColor.value.set('#7a3a1c');
    const back = new Mesh(new PlaneGeometry(backW, backW / backAspect), this.backMat);
    back.position.set(0, L.top + backW / backAspect / 2 - 3, L.maZ - 2.6);
    S.scene.add(back);

    // Steps and the ground in front, in stone.
    if (stoneArt.real) stoneArt.tex.wrapS = stoneArt.tex.wrapT = RepeatWrapping;
    this.stepMat = litMaterial(S, stoneArt.tex, { ambient: 0.012, gain: 1.05, transparent: false, repeat: [L.width / 1.6, 0.6] });
    for (let k = 0; k < rows; k++) {
      const h = (k + 1) * L.rise;
      const step = new Mesh(new BoxGeometry(L.width, h, L.tread), this.stepMat);
      step.position.set(0, h / 2, -(k + 0.5) * L.tread);
      S.scene.add(step);
    }
    const altar = new Mesh(new BoxGeometry(L.width * 0.86, 0.22, 2.4), this.stepMat);
    altar.position.set(0, L.top + 0.11, L.maZ + 0.2);
    S.scene.add(altar);
    const groundMat = litMaterial(S, stoneArt.tex, { ambient: 0.012, gain: 1.05, transparent: false, repeat: [40, 7] });
    const ground = new Mesh(new PlaneGeometry(90, 16), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 5);
    S.scene.add(ground);

    // A deep red and gold glow behind Ma, for midnight.
    this.halo = new Glows(1, S.scene, 2.6);
    this.halo.color(0, new Color('#b8202c').lerp(new Color(config.palette.gold), 0.25));
    this.halo.set(0, 0, L.maBase + L.maH * 0.62, L.maZ - 0.4, L.maH * 1.6, 0);
    this.halo.commit();
    this.halo.mesh.renderOrder = 5;

    this.maMat = litMaterial(S, maArt.tex, { ambient: 0.022, gain: 0.7 });
    this.ma = new Mesh(new PlaneGeometry(L.maW, L.maH), this.maMat);
    this.ma.position.set(0, L.maBase + L.maH / 2, L.maZ);
    this.ma.renderOrder = 10;
    S.scene.add(this.ma);

    await this.buildDecor();

    // 108 lamps on the front edge of the steps.
    const bowlAspect = aspectOf(bowlArt.tex);
    const size = c.lampScale * (portrait ? 0.8 : 1);
    const pts: Vector3[] = [];
    for (let k = 0; k < rows; k++) {
      for (let j = 0; j < L.perRow; j++) {
        const x = (j / (L.perRow - 1) - 0.5) * L.width * 0.9 + (k % 2 ? 0.5 : -0.5) * (L.width * 0.9) / (L.perRow - 1) * 0.3;
        pts.push(new Vector3(x, (k + 1) * L.rise + (size / bowlAspect) * 0.42, -k * L.tread - 0.24));
      }
    }
    const lampOpts = { bowl: bowlArt.tex, bowlAspect, ...(bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder), light: 5.5, lightAmp: 0.32, halo: 1.5, haloAmp: 0.16, ambient: 0.025 };
    this.lamps = new LampField(S, pts, size, lampOpts);
    this.lamps.onIgnite = () => this.onLampLit();
    this.first = new LampField(S, [new Vector3(0, (size * 1.5) / bowlAspect * 0.42, 1.4)], size * 1.5, {
      ...lampOpts,
      light: 7,
      lightAmp: 0.5,
    });
    this.carry = new LampField(S, [new Vector3()], size * 1.1, { bowl: null, light: 6, lightAmp: 0.5, halo: 1.8, haloAmp: 0.22 });
    this.carry.setAll(true, true);
    this.carry.master = 0;

    // The plane the carried flame slides on: through the front and back lamp rows.
    const a = new Vector3(0, pts[0]!.y + 0.08, pts[0]!.z);
    const b = new Vector3(0, pts[pts.length - 1]!.y + 0.08, pts[pts.length - 1]!.z);
    const along = b.clone().sub(a).normalize();
    const normal = new Vector3(1, 0, 0).cross(along).normalize();
    this.stepsPlane.setFromNormalAndCoplanarPoint(normal, a);

    this.embers = new Sparks(S, 600);
    this.embers.gravity = 0.45;
    this.embers.drag = 0.5;
    this.embers.wander = 0.8;

    S.onResize(() => this.computeShots());
    S.onFrame((dt) => this.update(dt));
    this.bindInput();
    this.rig.snap(this.shots.gate);
    this.state = 'gate';
    this.gate.classList.add('on');
  }

  /**
   * Kali Puja decoration beside Ma (art/ANTIGRAVITY-ROUND-2.md): lamp trees, ghots, dhaks, drapes, jaba strands and a
   * shola chandmala. Each piece appears only once its picture exists; nothing is drawn in its place.
   */
  private async buildDecor(): Promise<void> {
    const L = this.lay;
    const S = this.stage;
    const [tree, drape, strands, ghot, dhak, chand] = await Promise.all(
      ['decor-lamp-tree', 'decor-drape', 'decor-jaba-strands', 'decor-ghot', 'decor-dhak', 'decor-chandmala'].map((n) =>
        loadTexture(`intro/${n}.webp`),
      ),
    );
    const add = (tex: Texture, h: number, x: number, bottom: number, z: number, mirror: boolean, glow = false, order = 9) => {
      const w = h * aspectOf(tex);
      const mat = litMaterial(S, tex, { ambient: 0.02, gain: 0.8, emissive: 0 });
      lu(mat).uRiseColor.value.set('#ff9a50');
      const mesh = new Mesh(new PlaneGeometry(w, h), mat);
      mesh.position.set(x, bottom + h / 2, z);
      if (mirror) mesh.scale.x = -1;
      mesh.renderOrder = order;
      S.scene.add(mesh);
      this.decor.push({ mesh, mat, glow });
      return w;
    };
    const half = L.maW / 2;
    let side = half;
    if (tree) {
      const h = L.maH * 0.82;
      const w = h * aspectOf(tree);
      for (const s of [-1, 1]) add(tree, h, s * (half + w / 2 + 0.2), L.maBase, L.maZ + 0.35, s > 0, true);
      side = half + w + 0.2;
      // Their flames light Ma and the wall at midnight.
      this.treeLights = new Glows(2, S.lightScene);
      this.treeLights.colorAll(config.palette.amber);
      for (const [i, s] of [-1, 1].entries()) this.treeLights.set(i, s * (half + w / 2 + 0.2), L.maBase + h * 0.62, L.maZ + 0.4, h * 2.4, 0);
      this.treeLights.commit();
    }
    if (ghot) {
      const h = L.maH * 0.26;
      const w = h * aspectOf(ghot);
      for (const s of [-1, 1]) add(ghot, h, s * (side + w / 2 + 0.15), L.maBase, L.maZ + 0.7, s > 0);
      side += w + 0.15;
    }
    if (dhak) {
      const h = L.maH * 0.36;
      const w = h * aspectOf(dhak);
      for (const s of [-1, 1]) add(dhak, h, s * (side + w / 2 + 0.25), L.maBase, L.maZ + 0.9, s > 0);
      side += w + 0.25;
    }
    if (strands) {
      const h = L.maH * 1.15;
      const w = h * aspectOf(strands);
      for (const s of [-1, 1]) add(strands, h, s * (side + w / 2 - 0.1), L.maBase + L.maH * 0.42, L.maZ - 0.3, s > 0);
      side += w * 0.6;
    }
    if (drape) {
      const h = L.maH * 2.1;
      const w = h * aspectOf(drape);
      // The curtain is drawn hugging the left of its picture; the right one is the mirror.
      for (const s of [-1, 1]) add(drape, h, s * (side + w * 0.25), L.maBase - 0.3, L.maZ - 0.8, s > 0, false, 4);
      side += w * 0.55;
    }
    if (chand) {
      const w = Math.max(L.maW * 2.6, (side - 0.4) * 2);
      const h = w / aspectOf(chand);
      add(chand, h, 0, L.maBase + L.maH * 1.02, L.maZ + 0.25, false, false, 11);
    }
    L.sideHalf = side;
  }

  private computeShots(): void {
    if (!this.lay) return;
    const L = this.lay;
    const S = this.stage;
    const f = this.first?.pos[0] ?? new Vector3(0, 0.2, 1.4);
    this.shots.gate = { pos: f.clone().add(new Vector3(0, 0.55, 2.2)), target: f.clone().add(new Vector3(0, 0.4, 0)) };

    // Lighting: the lamp field fills the screen; Ma's feet show at the top, the rest of her waits for midnight.
    const halfRow = (L.width * 0.9) / 2 + 0.3;
    const front = L.rise + 0.25;
    const backZ = -(L.rows - 1) * L.tread - 0.24;
    const field = [
      new Vector3(-halfRow, front, 0),
      new Vector3(halfRow, front, 0),
      new Vector3(-halfRow, L.top + 0.25, backZ),
      new Vector3(halfRow, L.top + 0.25, backZ),
      new Vector3(0, L.maBase + L.maH * 0.3, L.maZ),
    ];
    const mid = new Vector3(0, (front + L.top) / 2 + 0.3, backZ / 2);
    this.shots.steps = fitShot(S, field, mid, new Vector3(0, 0.62, 1), { x: 0.97, y: S.aspect < 1 ? 0.8 : 0.84 });

    const maTop = L.maBase + L.maH;
    const maPts = [
      new Vector3(-L.maW / 2, L.maBase + L.maH * 0.35, L.maZ),
      new Vector3(L.maW / 2, L.maBase + L.maH * 0.35, L.maZ),
      new Vector3(0, maTop + 0.1, L.maZ),
    ];
    this.shots.ma = fitShot(S, maPts, new Vector3(0, L.maBase + L.maH * 0.66, L.maZ), new Vector3(0, 0.08, 1), { x: 0.92, y: 0.8 });

    // Blessing: Ma whole, with whatever stands beside her filling the sides, and the top rows of lamps below.
    const wide = S.aspect >= 1;
    const sx = wide ? Math.min(L.sideHalf, L.maH * 1.15 * S.aspect) : L.maW * 0.62;
    const blessPts = [
      new Vector3(-sx, L.maBase + L.maH * 0.5, L.maZ),
      new Vector3(sx, L.maBase + L.maH * 0.5, L.maZ),
      new Vector3(0, maTop + 0.25, L.maZ),
      new Vector3(0, L.top - L.rise * 1.5, -(L.rows - 2) * L.tread),
    ];
    this.shots.blessing = fitShot(S, blessPts, new Vector3(0, L.maBase + L.maH * 0.45, L.maZ + 0.5), new Vector3(0, 0.18, 1), { x: 0.98, y: 0.9 });
    if (this.state === 'lighting' || this.state === 'dark' || this.state === 'finishing') this.rig.snap(this.shots.steps);
    if (this.state === 'blessing') this.rig.snap(this.shots.blessing);
  }

  // ---------- states ----------

  private lightFirst(): void {
    if (this.state !== 'gate') return;
    parallax.requestMotion();
    this.gate.classList.remove('on');
    this.gate.classList.add('out');
    setTimeout(() => this.gate.remove(), 1600);
    this.first.ignite(0);
    buzz(18);
    this.state = 'dark';
    const c = config.intro;
    gsap.delayedCall(0.9, () => this.overlay.say('dark', config.copy.intro.dark, 'bottom', c.darkSeconds));
    this.rig.to(this.shots.steps, 5.5, 'power2.inOut');
    gsap.delayedCall(c.darkSeconds + 1.2, () => this.startLighting());
  }

  private startLighting(): void {
    if (this.state !== 'dark') return;
    this.state = 'lighting';
    this.overlay.hide('dark');
    const i = config.copy.intro.invite;
    // Instructions sit low on the screen, never over Ma.
    this.overlay.say('invite', { bn: i.bn, en: isTouch() ? config.copy.intro.inviteTouch : i.en }, 'bottom');
    this.skipBtn.hidden = false;
    this.idle = 0;
    this.stage.canvas.classList.add('carry');
  }

  private onLampLit(): void {
    const lit = this.lamps.litCount;
    this.idle = 0;
    if (lit >= 1) this.overlay.hide('invite');
    this.counterEl.textContent = `${bn(lit)} / ${bn(config.intro.count)}`;
    this.counterEl.classList.add('on');
    if (lit % 12 === 0) buzz(8);
    if (this.state === 'lighting' && lit >= config.intro.count * config.intro.autoFinishAt) this.finish();
  }

  /** Light whatever is left, back row last, then midnight. */
  private finish(): void {
    if (this.state !== 'lighting') return;
    this.state = 'finishing';
    this.assist?.kill();
    this.ghost = null;
    let d = 0;
    for (let i = 0; i < this.lamps.count; i++) {
      if (!this.lamps.isLit(i)) {
        this.lamps.ignite(i, d);
        d += 0.05;
      }
    }
    gsap.delayedCall(d + 0.8, () => this.midnight());
  }

  private skip(): void {
    if (this.state === 'dark' || this.state === 'lighting') {
      this.rig.snap(this.shots.steps);
      this.overlay.hide('dark');
      this.overlay.hide('invite');
      for (let i = 0; i < this.lamps.count; i++) this.lamps.ignite(i, (i % this.lay.perRow) * 0.01 + Math.floor(i / this.lay.perRow) * 0.08);
      this.state = 'finishing';
      gsap.delayedCall(1.2, () => this.midnight());
    }
  }

  private midnight(): void {
    if (this.state === 'midnight' || this.state === 'blessing') return;
    this.state = 'midnight';
    this.skipBtn.hidden = true;
    this.counterEl.classList.remove('on');
    this.stage.canvas.classList.remove('carry');
    this.carrying = false;
    buzz([30, 80, 30]);
    this.rig.to(this.shots.ma, 4.2, 'power2.inOut');
    const tl = gsap.timeline();
    tl.to(this, { riseTarget: 1.25, duration: 3.4, ease: 'power1.inOut' }, 0.4);
    tl.to(this, { treeAmp: 1, duration: 1.6, ease: 'power2.out' }, 1.2);
    tl.to(this, { haloAmp: 0.55, duration: 2.6, ease: 'power2.out' }, 1.6);
    tl.to(this.stage, { bloomBoost: 0.7, duration: 0.8, ease: 'power2.out' }, 2.6);
    tl.to(this.stage, { bloomBoost: 0.18, duration: 2.5, ease: 'power2.inOut' }, 3.4);
    tl.call(() => this.startPetals(), [], 2.8);
    tl.call(() => {
      this.state = 'blessing';
      this.rig.to(this.shots.blessing, 3.5, 'power2.inOut');
    }, [], config.intro.midnightSeconds);
  }

  // ---------- input ----------

  private bindInput(): void {
    const el = this.stage.canvas;
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
    };
    el.addEventListener('pointerdown', (e) => {
      pos(e);
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.down = true;
      if (this.state === 'lighting') {
        this.carrying = true;
        this.sweep(this.pointer.x, this.pointer.y, this.pointer.x, this.pointer.y);
      }
    });
    el.addEventListener('pointermove', (e) => {
      pos(e);
      this.pointer.inside = true;
      if (this.state !== 'lighting') return;
      if (e.pointerType === 'mouse') this.carrying = true;
      if (this.carrying) this.sweep(this.pointer.px, this.pointer.py, this.pointer.x, this.pointer.y);
    });
    // On phones the canvas lets vertical swipes scroll the page; a sideways sweep lights a row.
    const up = (e: PointerEvent) => {
      this.pointer.down = false;
      if (e.pointerType !== 'mouse') this.carrying = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      this.pointer.inside = false;
      if (e.pointerType === 'mouse') this.carrying = false;
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.state === 'gate' && window.scrollY < innerHeight * 0.5) {
          e.preventDefault();
          this.lightFirst();
        } else if (this.state === 'lighting' && !this.keyHeld) {
          e.preventDefault();
          this.keyHeld = true;
          this.runAssist(true);
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') this.keyHeld = false;
    });
  }

  /** Light every lamp whose flame lies near the segment the pointer just travelled. */
  private sweep(x0: number, y0: number, x1: number, y1: number): void {
    if (this.state !== 'lighting') return;
    const s = this.lamps.screen(this.screenPos);
    const { perRow } = this.lay;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    for (let i = 0; i < this.lamps.count; i++) {
      if (this.lamps.isLit(i)) continue;
      const p = s[i]!;
      const j = i % perRow;
      const nb = s[j < perRow - 1 ? i + 1 : i - 1]!;
      const gap = Math.hypot(nb.x - p.x, nb.y - p.y);
      const r = Math.max(config.intro.catchMinPx, gap * config.intro.catchFraction);
      let t = len2 > 0 ? ((p.x - x0) * dx + (p.y - y0) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x0 + dx * t - p.x, y0 + dy * t - p.y);
      // Lamps further along the stroke catch a moment later, so a fast sweep still reads as fire travelling.
      if (d < r) this.lamps.ignite(i, t * 0.08);
    }
  }

  /** Show how it's done: a ghost flame sweeps the lowest row that still has dark lamps. */
  private runAssist(continuous = false): void {
    if (this.state !== 'lighting' || this.assist?.isActive()) return;
    const { perRow, rows } = this.lay;
    let row = -1;
    for (let k = 0; k < rows && row < 0; k++) {
      for (let j = 0; j < perRow; j++) if (!this.lamps.isLit(k * perRow + j)) row = k;
    }
    if (row < 0) return;
    const s = this.lamps.screen(this.screenPos);
    const a = s[row * perRow]!;
    const b = s[row * perRow + perRow - 1]!;
    const g = { x: a.x - 30, y: a.y };
    this.ghost = g;
    let last = { ...g };
    this.assist = gsap.to(g, {
      x: b.x + 30,
      y: b.y,
      duration: 1.8,
      ease: 'sine.inOut',
      onUpdate: () => {
        this.sweep(last.x, last.y, g.x, g.y);
        last = { ...g };
      },
      onComplete: () => {
        this.ghost = null;
        this.idle = 0;
        if (continuous && this.keyHeld) this.runAssist(true);
      },
    });
  }

  // ---------- frame ----------

  private update(dt: number): void {
    if (this.state === 'loading') return;
    if (this.state === 'lighting') {
      this.idle += dt;
      if (this.idle > config.intro.assistAfterSeconds && !this.carrying) {
        this.idle = -3;
        this.runAssist();
      }
    }

    // The carried flame: on the pointer while carrying, on the ghost while it demonstrates.
    const at = this.ghost ?? (this.carrying || (this.pointer.inside && this.state === 'lighting' && !isTouch()) ? this.pointer : null);
    const want = at && (this.state === 'lighting' || this.state === 'finishing') ? 1 : 0;
    this.carryAmp += (want - this.carryAmp) * damp(0.08, dt);
    this.carry.master = this.carryAmp;
    this.carry.setSize(0, this.lamps.size[0]! * 1.5 * (0.3 + 0.7 * this.carryAmp));
    if (at) {
      const r = this.stage.canvas.getBoundingClientRect();
      const ndc = new Vector2((at.x / r.width) * 2 - 1, 1 - (at.y / r.height) * 2);
      this.raycaster.setFromCamera(ndc, this.stage.camera);
      const hit = this.raycaster.ray.intersectPlane(this.stepsPlane, new Vector3());
      if (hit) this.carry.setPosition(0, hit);
    }

    // The light climbs Ma (and what stands beside her) as the rows fill.
    if (this.state === 'lighting' || this.state === 'finishing' || this.state === 'dark') {
      this.riseTarget = 0.05 + 0.6 * (this.lamps.litCount / this.lamps.count);
    }
    this.rise += (this.riseTarget - this.rise) * damp(0.5, dt);
    const m = lu(this.maMat);
    m.uRise.value = this.rise;
    m.uRiseGain.value = 0.95 * Math.min(1, this.rise * 4);
    const b = lu(this.backMat);
    b.uRise.value = this.rise * 0.6;
    b.uRiseGain.value = 0.35 * Math.min(1, this.rise * 3);
    this.halo.amp(0, this.haloAmp);
    this.halo.commit();
    const flick = 1 + 0.06 * Math.sin(performance.now() / 90) + 0.04 * Math.sin(performance.now() / 47);
    for (const d of this.decor) {
      const u = lu(d.mat);
      u.uRise.value = this.rise;
      u.uRiseGain.value = 0.7 * Math.min(1, this.rise * 3);
      u.uFlood.value.setRGB(0.5, 0.22, 0.1).multiplyScalar(this.haloAmp * 0.5);
      if (d.glow) u.uEmissive.value = 0.15 + this.treeAmp * 0.95 * flick;
    }
    if (this.treeLights) {
      this.treeLights.amp(0, this.treeAmp * 0.55 * flick);
      this.treeLights.amp(1, this.treeAmp * 0.55 * flick);
      this.treeLights.commit();
    }

    this.emitEmbers(dt);
    this.updatePetals(dt);
  }

  /** Embers rise all the time: from the dark ground at the gate, from the lamps once they burn. */
  private emitEmbers(dt: number): void {
    const s = this.state;
    const rate = s === 'midnight' ? 50 : s === 'blessing' ? 12 : s === 'gate' ? 14 : this.lamps.litCount > 0 ? 4 : 0;
    const n = Math.random() < (rate * dt) % 1 ? Math.ceil(rate * dt) : Math.floor(rate * dt);
    const p = new Vector3();
    for (let k = 0; k < n; k++) {
      if (s === 'gate') {
        const f = this.first.pos[0]!;
        p.set(f.x + (Math.random() - 0.5) * 3.2, f.y - 0.1, f.z - Math.random() * 1.5);
      } else {
        this.lamps.flamePoint(Math.floor(Math.random() * this.lamps.count), p);
      }
      this.embers.emit({
        x: p.x,
        y: p.y + 0.05,
        z: p.z,
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.3 + Math.random() * 0.5,
        life: 2 + Math.random() * 2.5,
        size: 0.025 + Math.random() * 0.03,
        color: new Color(config.palette.amber),
        heat: 2.2,
      });
    }
  }

  private startPetals(): void {
    if (!this.petalTex.length) return;
    const L = this.lay;
    for (let i = 0; i < 46; i++) {
      const mat = new SpriteMaterial({
        map: this.petalTex[i % this.petalTex.length]!,
        color: new Color('#ffcfb8').multiplyScalar(0.9),
        transparent: true,
        depthWrite: false,
      });
      const s = new Sprite(mat);
      const sz = 0.09 + Math.random() * 0.07;
      s.scale.set(sz, sz, 1);
      const x0 = (Math.random() - 0.5) * Math.max(L.maW * 2.2, L.sideHalf * 1.6);
      s.position.set(x0, L.maBase + L.maH + 0.5 + Math.random() * 3, L.maZ + 0.3 + Math.random() * 1.6);
      s.renderOrder = 40;
      this.stage.scene.add(s);
      this.petals.push({ s, vy: 0.35 + Math.random() * 0.3, ph: Math.random() * 6.28, spin: (Math.random() - 0.5) * 2, x0 });
    }
  }

  private updatePetals(dt: number): void {
    const floor = this.lay ? this.lay.top - this.lay.rise * 3 : 0;
    for (const p of this.petals) {
      p.ph += dt;
      p.s.position.y -= p.vy * dt;
      p.s.position.x = p.x0 + Math.sin(p.ph * 1.3) * 0.25;
      (p.s.material as SpriteMaterial).rotation += p.spin * dt;
      if (p.s.position.y < floor) {
        p.s.position.y = this.lay.maBase + this.lay.maH + 0.8;
      }
    }
  }
}
