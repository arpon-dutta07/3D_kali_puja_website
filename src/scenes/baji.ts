import { gsap } from 'gsap';
import { Mesh, PlaneGeometry, Vector3, type ShaderMaterial, type Texture } from 'three';
import { config } from '../config';
import { sfx, soundButton, soundFireworks, type LoopHandle } from '../audio/sfx';
import { CameraRig } from '../gl/camera';
import { Fireworks, SHELLS, randomColor, type Shell } from '../gl/fireworks';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadTexture } from '../lib/assets';
import { buzz, clamp, isTouch } from '../lib/device';
import type { Chapter } from '../journey';
import { Overlay } from '../ui/overlay';

/** Line icons for the four pieces, drawn in one style (no emoji). */
const ICONS: Record<string, string> = {
  rocket:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c3 3 4.5 7 4.5 11v8h-9v-8c0-4 1.5-8 4.5-11z"/><path d="M11.5 18l-3 4v3l3-1M20.5 18l3 4v3l-3-1M14 25l2 4 2-4"/><circle cx="16" cy="12" r="1.8"/></svg>',
  tubri:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 28h12l-2-11h-8z"/><path d="M14 17v-3h4v3"/><path d="M16 11V4M12.5 12l-3-6M19.5 12l3-6M10.5 14l-5-3M21.5 14l5-3"/></svg>',
  chorki:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="3.2"/><path d="M16 12.8c4 0 7 2 7 5.6S19.6 25 16 25s-9-3-9-8.6S11.5 7 16 7s11 3.4 11 9.4"/><path d="M27 16.4l1.8 2.6M27 16.4l-2.8 1.3"/></svg>',
  skyshot:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="19" width="14" height="9" rx="1"/><path d="M12 19v-2M16 19v-2M20 19v-2"/><circle cx="9" cy="8" r="2"/><circle cx="23" cy="6" r="2.6"/><circle cx="16" cy="11" r="1.6"/><path d="M9 3.5v1.5M9 11v1.5M4.5 8H6M12 8h1.5M23 1v1.8M23 9.2V11M18.4 6h1.8M25.8 6h1.8"/></svg>',
};

/**
 * বাজি: the rooftop at night, the fourteen prodips still burning. Tap the sky anywhere and a shell bursts there; the
 * bar below fires a rocket, lights a tubri or a chorki on the wall, or sets off a sky-shot box.
 */
export class Baji implements Chapter {
  readonly stage: Stage;
  readonly overlay: Overlay;
  done = false;
  onDone: (() => void) | null = null;
  private rig: CameraRig;
  private D = 10;
  private view = { w: 1, h: 1 };
  private bg!: Mesh;
  private bgMat!: ShaderMaterial;
  private ledgeFrac = 0.655;
  private ledgeY = 0;
  private lamps!: LampField;
  private bowlAspect = 1;
  private fw!: Fireworks;
  private engaged = false;
  private shellTurn = 0;
  private hinted = false;
  private bar!: HTMLElement;
  private tubriTex: Texture | null = null;
  private tubriAspect = 1;
  private lampSize = 0.3;

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 45, background: '#03040b' });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.1;
    this.overlay = new Overlay(section);
    soundButton(this.overlay.root);
    this.buildBar();
  }

  private buildBar(): void {
    const c = config.copy.baji;
    const bar = document.createElement('div');
    bar.className = 'baji-bar';
    this.bar = bar;
    const items: Array<[keyof typeof ICONS, string, () => void]> = [
      ['rocket', c.rocket, () => this.rocket()],
      ['tubri', c.tubri, () => this.tubri()],
      ['chorki', c.chorki, () => this.chorki()],
      ['skyshot', c.skyshot, () => this.skyshot()],
    ];
    for (const [icon, label, fn] of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `${ICONS[icon]}<span>${label}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx.unlock();
        buzz(10);
        fn();
      });
      bar.appendChild(b);
    }
    this.overlay.root.appendChild(bar);
  }

  async init(): Promise<void> {
    const S = this.stage;
    const portrait = S.aspect < 1;
    const [roof, roofTall, bowlArt, tubriArt] = await Promise.all([
      loadTexture('chhad/rooftop.webp'),
      loadTexture('chhad/rooftop-tall.webp'),
      artOr('common/prodip.webp', ph.prodipBowl),
      loadTexture('chhad/tubri.webp'),
    ]);
    this.tubriTex = tubriArt;
    if (tubriArt) this.tubriAspect = aspectOf(tubriArt);
    let pic: Texture = roof ?? ph.city(false);
    if (portrait && roofTall) {
      pic = roofTall;
      this.ledgeFrac = config.chhad.ledgeTall;
    } else {
      this.ledgeFrac = config.chhad.ledgeWide;
    }
    // The same rooftop, but night: the photo dimmed and cooled, lit by the lamps and every burst.
    this.bgMat = litMaterial(S, pic, { ambient: '#575c75', gain: 0.9, transparent: false });
    this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(pic)), this.bgMat);
    S.scene.add(this.bg);

    this.bowlAspect = aspectOf(bowlArt.tex);
    const flame = bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder;
    this.lamps = new LampField(S, Array.from({ length: config.chhad.lamps }, () => new Vector3()), 1, {
      bowl: bowlArt.tex,
      bowlAspect: this.bowlAspect,
      ...flame,
      light: 7,
      lightAmp: 0.45,
    });
    this.lamps.setAll(true, true);

    this.fw = new Fireworks(S, 12000);
    this.fw.z = 0.05;
    soundFireworks(this.fw, (x) => x / (this.view.w / 2));

    S.onResize(() => this.layout());
    this.bindInput();
  }

  private layout(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    this.view.h = 2 * this.D * tan;
    this.view.w = this.view.h * S.aspect;
    const { w, h } = this.view;
    this.rig.snap({ pos: new Vector3(0, 0, this.D), target: new Vector3(0, 0, 0) });
    const a = 1 / (this.bg.geometry as PlaneGeometry).parameters.height;
    const pw = Math.max(w * 1.06, h * 1.06 * a);
    const ph_ = pw / a;
    this.bg.scale.set(pw, pw, 1);
    this.ledgeY = ph_ / 2 - ph_ * this.ledgeFrac;
    const n = this.lamps.count;
    const span = w * (S.aspect < 1 ? 0.94 : 0.8);
    const gap = span / n;
    const size = clamp(gap * (S.aspect < 1 ? 0.9 : 0.62), 0.18, 0.5);
    this.lampSize = size;
    for (let i = 0; i < n; i++) {
      this.lamps.setSize(i, size);
      this.lamps.setPosition(i, new Vector3(-span / 2 + gap * (i + 0.5), this.ledgeY + (size / this.bowlAspect) * 0.42, 0.1));
    }
    this.fw.u = Math.min(h, w * 1.4) / 8.3;
    this.fw.groundY = this.ledgeY;
  }

  engage(): void {
    if (this.engaged) return;
    this.engaged = true;
    this.bar.classList.add('on');
    const hint = config.copy.baji.hint;
    this.overlay.say('hint', isTouch() ? { bn: hint.bn } : hint, 'top', 6);
    // Open with a little show so the sky is never empty.
    const { w } = this.view;
    this.fw.launch(-0.25 * w, -0.25 * w, this.skyY(0.55), 'peony');
    setTimeout(() => this.fw.launch(0.28 * w, 0.28 * w, this.skyY(0.7), 'chrysanthemum'), 700);
  }

  skip(): void {
    /* Nothing to finish: this one is play. */
  }

  /** A height in the sky above the wall, 0 = ledge, 1 = top of the screen. */
  private skyY(f: number): number {
    return this.ledgeY + (this.view.h / 2 - this.ledgeY) * f;
  }

  private nextShell(): Shell {
    // Every tap a different kind, in a shuffled order.
    const s = SHELLS[(this.shellTurn * 5 + 3) % SHELLS.length]!;
    this.shellTurn++;
    return s;
  }

  private bindInput(): void {
    const el = this.stage.canvas;
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged) return;
      const r = el.getBoundingClientRect();
      const p = this.stage.fromScreen(e.clientX - r.left, e.clientY - r.top, 0);
      if (p.y < this.ledgeY + this.view.h * 0.06) return;
      sfx.unlock();
      if (!this.hinted) {
        this.hinted = true;
        this.overlay.hide('hint');
      }
      // The rocket rises from the wall right under the tap.
      this.fw.launch(p.x + (Math.random() - 0.5) * this.view.w * 0.05, p.x, p.y, this.nextShell(), [randomColor(), randomColor()]);
    });
  }

  private rocket(): void {
    const { w } = this.view;
    const x = (Math.random() - 0.5) * w * 0.7;
    this.fw.launch(x, x + (Math.random() - 0.5) * w * 0.2, this.skyY(0.55 + Math.random() * 0.35), this.nextShell());
  }

  private onWall(): number {
    return (Math.random() - 0.5) * this.view.w * 0.6;
  }

  private tubri(): void {
    const x = this.onWall();
    const top = this.placeTubri(x, 6);
    this.fw.fountain(x, top, 6);
    this.fizz(x, 6, 1);
  }

  /** The clay tubri itself, set on the wall for as long as it burns; returns the height of its mouth. */
  private placeTubri(x: number, seconds: number): number {
    const hgt = this.lampSize * 1.9;
    if (!this.tubriTex) return this.ledgeY + 0.02;
    const m = litMaterial(this.stage, this.tubriTex, { ambient: 0.35, gain: 1.2 });
    const mesh = new Mesh(new PlaneGeometry(hgt * this.tubriAspect, hgt), m);
    mesh.position.set(x, this.ledgeY + hgt * 0.42, 0.12);
    mesh.renderOrder = 5;
    this.stage.scene.add(mesh);
    gsap.to(lu(m).uOpacity, {
      value: 0,
      duration: 1.2,
      delay: seconds + 0.8,
      onComplete: () => {
        this.stage.scene.remove(mesh);
        mesh.geometry.dispose();
        m.dispose();
      },
    });
    return this.ledgeY + hgt * 0.88;
  }

  private chorki(): void {
    const x = this.onWall();
    this.fw.spinner(x, this.ledgeY + 0.04, 6);
    this.fizz(x, 6, 1.35);
  }

  private fizz(x: number, seconds: number, rate: number): void {
    const h: LoopHandle | null = sfx.loop('fizz', { gain: 0.55, pan: x / (this.view.w / 2), rate });
    if (h) setTimeout(() => h.stop(0.6), seconds * 1000 - 400);
  }

  /** A sky-shot box: shell after shell from one spot, each a different kind and colour. */
  private skyshot(): void {
    const x = this.onWall();
    const n = 8;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const tx = x + (Math.random() - 0.5) * this.view.w * 0.25;
        this.fw.launch(x, tx, this.skyY(0.45 + Math.random() * 0.45), this.nextShell());
      }, i * 420);
    }
  }
}
