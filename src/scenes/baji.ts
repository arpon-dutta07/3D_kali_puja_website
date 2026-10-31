import { gsap } from 'gsap';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
  type Texture,
} from 'three';
import { config } from '../config';
import { sfx, soundButton, soundFireworks, type LoopHandle } from '../audio/sfx';
import { CameraRig } from '../gl/camera';
import { Fireworks, SHELLS, randomColor, type Shell, type SparklerHandle } from '../gl/fireworks';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, loadTexture } from '../lib/assets';
import { buzz, isTouch } from '../lib/device';
import { journal } from '../lib/journal';
import type { Chapter } from '../journey';
import { Overlay } from '../ui/overlay';

/** Measured on chhad/city.webp (u from the left, v from the top): the near parapet's top, the flat run of it, the roofline. */
const CITY = { ledgeV: 0.835, flatU0: 0.14, flatU1: 0.77, horizonV: 0.5, portraitU: 0.56 };

/** রংমশাল colours, taken in turn. */
const TORCH = ['#38ff7a', '#ff3048', '#ff4fd8', '#ffd23a'].map((c) => new Color(c));

/** Line icons for the pieces, drawn in one style (no emoji). */
const ICONS = {
  rocket:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5c2.4 2.2 3.4 5.2 3.4 8.4V19h-6.8v-8.1c0-3.2 1-6.2 3.4-8.4z"/><path d="M16 19v11"/><path d="M12.6 15.5l-2.6 3.2v2.1l2.6-.9M19.4 15.5l2.6 3.2v2.1l-2.6-.9"/><circle cx="16" cy="10" r="1.5"/></svg>',
  tubri:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 28h12l-2-11h-8z"/><path d="M14 17v-3h4v3"/><path d="M16 11V4M12.5 12l-3-6M19.5 12l3-6M10.5 14l-5-3M21.5 14l5-3"/></svg>',
  chorki:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="3.2"/><path d="M16 12.8c4 0 7 2 7 5.6S19.6 25 16 25s-9-3-9-8.6S11.5 7 16 7s11 3.4 11 9.4"/><path d="M27 16.4l1.8 2.6M27 16.4l-2.8 1.3"/></svg>',
  torch:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 29V15"/><path d="M13.6 15h4.8"/><path d="M16 4c2.6 2.6 4 4.8 4 7a4 4 0 0 1-8 0c0-1.6.8-2.6 1.6-3.6.2 1.3.8 2 1.6 2.4-.2-2 .1-3.8.8-5.8z"/><path d="M9 9l-1.6-1M23 9l1.6-1M10 14l-2 .4M22 14l2 .4"/></svg>',
  sparkler:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 29L19 12"/><circle cx="21" cy="9" r="2"/><path d="M21 2.5v2.6M21 12.9v2.6M14.5 9h2.6M24.9 9h2.6M16.4 4.4l1.8 1.8M23.8 11.8l1.8 1.8M16.4 13.6l1.8-1.8M23.8 6.2l1.8-1.8"/></svg>',
  skyshot:
    '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="19" width="14" height="9" rx="1"/><path d="M12 19v-2M16 19v-2M20 19v-2"/><circle cx="9" cy="8" r="2"/><circle cx="23" cy="6" r="2.6"/><circle cx="16" cy="11" r="1.6"/><path d="M9 3.5v1.5M9 11v1.5M4.5 8H6M12 8h1.5M23 1v1.8M23 9.2V11M18.4 6h1.8M25.8 6h1.8"/></svg>',
};

/** Darkens the photo's sky to night, black at the top, clear by the roofline. */
function skyShade(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uHorizon: { value: 0 }, uTop: { value: 1 } },
    vertexShader: `varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uHorizon; uniform float uTop; varying float vY;
      void main() {
        float span = uTop - uHorizon;
        // The sunset left on the photo's horizon goes too: a soft veil from just below the roofs, black above.
        float a = smoothstep(uHorizon - span * 0.35, uHorizon + span * 0.15, vY) * 0.5 + smoothstep(uHorizon, uTop - span * 0.25, vY) * 0.47;
        gl_FragColor = vec4(0.0, 0.0, 0.006, a);
      }`,
  });
}

/** A few hundred faint stars that twinkle (deterministic, the same sky on every visit). */
function stars(n: number): { points: Points; mat: ShaderMaterial; place: (w: number, y0: number, y1: number) => void } {
  const g = new BufferGeometry();
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const u = Array.from({ length: n }, () => [rnd(), rnd(), rnd()] as const);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
      void main() { vA = (0.35 + 0.65 * fract(aSeed * 7.3)) * (0.6 + 0.4 * sin(uTime * (0.8 + fract(aSeed * 3.1) * 2.0) + aSeed * 40.0));
        gl_PointSize = uPx * (1.0 + 1.6 * fract(aSeed * 11.7)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vA * smoothstep(0.5, 0.0, d), 1.0); }`,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  const place = (w: number, y0: number, y1: number) => {
    for (let i = 0; i < n; i++) {
      const [a, b, c] = u[i]!;
      // Thinner towards the roofline, where the city's haze is.
      pos.set([(a - 0.5) * w, y0 + (y1 - y0) * Math.sqrt(b), 0.012], i * 3);
      seed[i] = c;
    }
    g.attributes.position!.needsUpdate = true;
    g.attributes.aSeed!.needsUpdate = true;
  };
  return { points, mat, place };
}

/**
 * বাজির রাত: a dark Kolkata night from the roof, the sky black and full of stars. Tap the sky anywhere and a shell
 * bursts there; the bar fires a হাউই, lights a tubri, a chorki or a রংমশাল on the parapet, puts a ফুলঝুরি in your
 * hand, or sets off a sky-shot box. Far across the city, other roofs are at it too.
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
  private shade!: Mesh;
  private sky!: ReturnType<typeof stars>;
  private ledgeY = 0;
  private horizonY = 0;
  /** The parapet's flat run in world x (a tubri never stands where the wall slopes away). */
  private wallX: [number, number] = [-1, 1];
  private fw!: Fireworks;
  private far!: Fireworks;
  private farTimer = 2;
  private engaged = false;
  private shellTurn = 0;
  private torchTurn = 0;
  private hinted = false;
  private bar!: HTMLElement;
  private sparkBtn!: HTMLButtonElement;
  private tubriTex: Texture | null = null;
  private tubriAspect = 1;
  private sparkler: SparklerHandle | null = null;
  private sparkFizz: LoopHandle | null = null;
  private pointerDown = false;

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 45, background: '#010104' });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.06;
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
      ['torch', c.torch, () => this.torch()],
      ['sparkler', c.sparkler, () => this.toggleSparkler()],
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
        journal.baji();
        fn();
      });
      if (icon === 'sparkler') this.sparkBtn = b;
      bar.appendChild(b);
    }
    this.overlay.root.appendChild(bar);
  }

  async init(): Promise<void> {
    const S = this.stage;
    const [city, tubriArt] = await Promise.all([artOr('chhad/city.webp', () => ph.city(false)), loadTexture('chhad/tubri.webp')]);
    this.tubriTex = tubriArt;
    if (tubriArt) this.tubriAspect = aspectOf(tubriArt);
    // The city at night: the photo pulled right down, so only the fireworks light the roofs.
    this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(city.tex)), litMaterial(S, city.tex, { ambient: '#2a2f45', gain: 0.95, transparent: false }));
    S.scene.add(this.bg);
    this.shade = new Mesh(new PlaneGeometry(1, 1), skyShade());
    this.shade.position.z = 0.01;
    this.shade.renderOrder = 1;
    S.scene.add(this.shade);
    this.sky = stars(260);
    S.scene.add(this.sky.points);

    this.fw = new Fireworks(S, 14000);
    this.fw.z = 0.05;
    soundFireworks(this.fw, (x) => x / (this.view.w / 2));
    // Other roofs across the city: small, low, quiet.
    this.far = new Fireworks(S, 3000);
    this.far.z = 0.03;
    soundFireworks(this.far, (x) => x / (this.view.w / 2), 0.2);
    this.far.onLaunch = null;

    S.onResize(() => this.layout());
    S.onFrame((dt, time) => this.update(dt, time));
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
    // Bottom of the photo on the bottom of the screen: the parapet sits low, the sky gets the rest.
    const spare = (pw - w) / 2;
    this.bg.position.x = S.aspect < 1 ? Math.max(-spare, Math.min(spare, (0.5 - CITY.portraitU) * pw)) : 0;
    this.bg.position.y = -h / 2 + ph_ / 2 - (ph_ - h) * 0.04;
    const top = this.bg.position.y + ph_ / 2;
    this.ledgeY = top - ph_ * CITY.ledgeV;
    this.horizonY = top - ph_ * CITY.horizonV;
    const ux = (u: number) => this.bg.position.x + (u - 0.5) * pw;
    this.wallX = [Math.max(-w * 0.44, ux(CITY.flatU0)), Math.min(w * 0.44, ux(CITY.flatU1))];
    this.shade.scale.set(pw, ph_, 1);
    this.shade.position.set(this.bg.position.x, this.bg.position.y, 0.01);
    const sh = this.shade.material as ShaderMaterial;
    sh.uniforms.uHorizon!.value = this.horizonY;
    sh.uniforms.uTop!.value = h / 2;
    this.sky.place(w * 1.05, this.horizonY + (h / 2 - this.horizonY) * 0.25, h / 2);
    this.sky.mat.uniforms.uPx!.value = Math.min(2, window.devicePixelRatio || 1) * 1.1;
    this.fw.u = Math.min(h, w * 1.4) / 8.3;
    this.fw.groundY = this.ledgeY;
    this.far.u = this.fw.u * 0.32;
    this.far.groundY = this.horizonY - (h / 2 - this.horizonY) * 0.05;
  }

  engage(): void {
    if (this.engaged) return;
    this.engaged = true;
    this.bar.classList.add('on');
    const hint = config.copy.baji.hint;
    this.overlay.say('hint', isTouch() ? { bn: hint.bn } : hint, 'top', 6);
    // Open with a little show so the sky is never empty.
    const { w } = this.view;
    this.fw.launch(-0.25 * w, -0.25 * w, this.skyY(0.6), 'peony');
    setTimeout(() => this.fw.hawai(this.wallAt(0.75), this.skyH(0.7), 0.06), 500);
    setTimeout(() => this.fw.launch(0.28 * w, 0.28 * w, this.skyY(0.72), 'chrysanthemum'), 900);
  }

  skip(): void {
    /* Nothing to finish: this one is play. */
  }

  /** A height in the sky above the wall, 0 = ledge, 1 = top of the screen. */
  private skyY(f: number): number {
    return this.ledgeY + this.skyH(f);
  }

  private skyH(f: number): number {
    return (this.view.h / 2 - this.ledgeY) * f;
  }

  /** A spot on the parapet's flat run (0..1 along it, or random). */
  private wallAt(f = Math.random()): number {
    const [a, b] = this.wallX;
    return a + (b - a) * (0.06 + f * 0.88);
  }

  private nextShell(): Shell {
    // Every tap a different kind, in a shuffled order.
    const s = SHELLS[(this.shellTurn * 5 + 3) % SHELLS.length]!;
    this.shellTurn++;
    return s;
  }

  private bindInput(): void {
    const el = this.stage.canvas;
    const world = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return this.stage.fromScreen(e.clientX - r.left, e.clientY - r.top, 0);
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.engaged) return;
      sfx.unlock();
      const p = world(e);
      if (this.sparkler?.alive) {
        this.pointerDown = true;
        this.sparkler.move(p.x, p.y);
        return;
      }
      if (p.y < this.ledgeY + this.view.h * 0.06) return;
      if (!this.hinted) {
        this.hinted = true;
        this.overlay.hide('hint');
      }
      // The shell goes up from the roof right under the tap.
      this.fw.launch(p.x + (Math.random() - 0.5) * this.view.w * 0.05, p.x, p.y, this.nextShell(), [randomColor(), randomColor()]);
      journal.baji();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.sparkler?.alive) return;
      // A mouse carries the sparkler as it moves; a finger while it is down.
      if (e.pointerType === 'mouse' || this.pointerDown) {
        const p = world(e);
        this.sparkler.move(p.x, p.y);
      }
    });
    const up = () => {
      this.pointerDown = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private rocket(): void {
    // A হাউই goes up from the parapet, leaning a little.
    this.fw.hawai(this.wallAt(), this.skyH(0.55 + Math.random() * 0.3), (Math.random() - 0.5) * 0.3);
  }

  private tubri(): void {
    const x = this.wallAt();
    const top = this.placeTubri(x, 7);
    this.fw.fountain(x, top, 7);
    this.fizz(x, 7, 1, 0.6);
  }

  /** The clay tubri itself, set on the wall for as long as it burns; returns the height of its mouth. */
  private placeTubri(x: number, seconds: number): number {
    const hgt = this.view.h * 0.085;
    if (!this.tubriTex) return this.ledgeY + 0.02;
    const m = litMaterial(this.stage, this.tubriTex, { ambient: 0.3, gain: 1.25 });
    const mesh = new Mesh(new PlaneGeometry(hgt * this.tubriAspect, hgt), m);
    mesh.position.set(x, this.ledgeY + hgt * 0.42, 0.04);
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
    return this.ledgeY + hgt * 0.9;
  }

  private chorki(): void {
    const x = this.wallAt();
    this.fw.spinner(x, this.ledgeY + 0.04, 6);
    this.fizz(x, 6, 1.35, 0.55);
  }

  private torch(): void {
    const x = this.wallAt();
    const c = TORCH[this.torchTurn++ % TORCH.length]!;
    this.fw.torch(x, this.ledgeY + 0.05, c, 8);
    this.fizz(x, 8, 0.75, 0.5);
  }

  /** ফুলঝুরি: one in your hand, burning for half a minute; move it to write in the dark. */
  private toggleSparkler(): void {
    if (this.sparkler?.alive) {
      this.endSparkler();
      return;
    }
    const s = this.fw.sparkler(0, this.skyY(0.4), 25);
    this.sparkler = s;
    this.sparkBtn.classList.add('active');
    this.stage.canvas.classList.add('hold');
    this.overlay.hide('hint', true);
    const sp = config.copy.baji.sparklerHint;
    this.overlay.say('spark', isTouch() ? { bn: sp.bn } : sp, 'top', 4);
    this.sparkFizz = sfx.loop('fizz', { gain: 0.3, rate: 1.75 });
    gsap.delayedCall(25, () => {
      if (this.sparkler === s) this.endSparkler();
    });
  }

  private endSparkler(): void {
    this.sparkler?.stop();
    this.sparkler = null;
    this.sparkFizz?.stop(0.5);
    this.sparkFizz = null;
    this.pointerDown = false;
    this.sparkBtn.classList.remove('active');
    this.stage.canvas.classList.remove('hold');
  }

  private fizz(x: number, seconds: number, rate: number, gain: number): void {
    const h = sfx.loop('fizz', { gain, pan: x / (this.view.w / 2), rate });
    if (h) setTimeout(() => h.stop(0.6), seconds * 1000 - 400);
  }

  /** A sky-shot box: shell after shell from one spot, each a different kind and colour. */
  private skyshot(): void {
    const x = this.wallAt();
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const tx = x + (Math.random() - 0.5) * this.view.w * 0.25;
        this.fw.launch(x, tx, this.skyY(0.45 + Math.random() * 0.45), this.nextShell());
      }, i * 420);
    }
  }

  private update(dt: number, time: number): void {
    this.sky.mat.uniforms.uTime!.value = time;
    if (!this.engaged) return;
    // Someone else's roof, somewhere across the city.
    this.farTimer -= dt;
    if (this.farTimer <= 0) {
      this.farTimer = 1.8 + Math.random() * 3.5;
      const { w } = this.view;
      const x = (Math.random() - 0.5) * w * 0.95;
      const y = this.horizonY + (this.view.h / 2 - this.horizonY) * (0.08 + Math.random() * 0.22);
      this.far.launch(x, x, y);
    }
    if (this.sparkler && !this.sparkler.alive) this.endSparkler();
  }
}
