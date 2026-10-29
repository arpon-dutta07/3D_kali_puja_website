import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, MathUtils, Points, ShaderMaterial, Vector2 } from 'three';
import { Glows } from './glows';
import type { Stage } from './stage';

export type Shell = 'peony' | 'chrysanthemum' | 'willow' | 'palm' | 'ring' | 'crossette' | 'strobe' | 'crackle' | 'double';
export const SHELLS: Shell[] = ['peony', 'chrysanthemum', 'willow', 'palm', 'ring', 'crossette', 'strobe', 'crackle', 'double'];

/** Colours real stars burn: strontium red, sodium gold, barium green, copper blue, and the mixes. */
const PALETTE = ['#ff2a2a', '#ff7a1a', '#ffc84a', '#fff07a', '#3cff6a', '#3a8bff', '#b05cff', '#ffffff', '#4af0ff', '#ff5ad2'].map(
  (c) => new Color(c),
);
const GOLD = new Color('#ffbf5a');
const WHITE = new Color('#fff6e8');
const SKIN = new Color('#3d6bff');

export function randomColor(): Color {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
}

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float core = exp(-d * 9.0);
    float glow = exp(-d * 2.6);
    vec3 c = vColor * glow + vec3(1.0) * core * 0.9;
    gl_FragColor = vec4(c * vAlpha, 1.0);
  }
`;

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ty: number;
  shell: Shell;
  colors: [Color, Color];
  /** Formation shells carry their target points instead of a pattern. */
  form: FormPoint[] | null;
  /** Brightness of a formation's sparks: dense lettering needs less, or it burns white. */
  formHeat?: number;
}

interface Emitter {
  kind: 'fountain' | 'spinner';
  x: number;
  y: number;
  t: number;
  life: number;
  angle: number;
  color: Color;
}

export interface FormPoint {
  x: number;
  y: number;
  color: Color;
}

/**
 * A fireworks display drawn as additive points with bloom. Positions are world units on the plane z = `z`; `u` is
 * the size of one "unit" of a burst, so the same code reads right on a phone and on a big screen.
 */
export class Fireworks {
  readonly points: Points;
  /** World units per burst unit (set from the view height). */
  u = 1;
  z = 0;
  /** Where rockets start from (the rooftop ledge, the ground). */
  groundY = -3;
  onLaunch: ((x: number) => void) | null = null;
  onBurst: ((shell: Shell, x: number, big: boolean) => void) | null = null;
  onCrackle: ((x: number) => void) | null = null;
  private n: number;
  private next = 0;
  private px: Float32Array;
  private py: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size0: Float32Array;
  private heat: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private trail: Float32Array;
  private trailT: Float32Array;
  private strobe: Uint8Array;
  private split: Float32Array;
  private crackle: Float32Array;
  /** Formation: start, target and timing per particle (form < 0 = plain physics). */
  private form: Float32Array;
  private sx: Float32Array;
  private sy: Float32Array;
  private tx: Float32Array;
  private ty: Float32Array;
  private hold: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private aPos: BufferAttribute;
  private aSize: BufferAttribute;
  private aAlpha: BufferAttribute;
  private aColor: BufferAttribute;
  private mat: ShaderMaterial;
  private rockets: Rocket[] = [];
  private emitters: Emitter[] = [];
  private flashes: Glows;
  private halos: Glows;
  private flashAmp: Float32Array;
  private nextFlash = 0;
  private time = 0;
  private tmpC = new Color();

  constructor(
    stage: Stage,
    capacity = 9000,
  ) {
    const n = (this.n = capacity);
    const f = () => new Float32Array(n);
    this.px = f();
    this.py = f();
    this.vx = f();
    this.vy = f();
    this.life = f();
    this.max = f().fill(1);
    this.size0 = f();
    this.heat = f();
    this.drag = f();
    this.grav = f();
    this.trail = f();
    this.trailT = f();
    this.strobe = new Uint8Array(n);
    this.split = f();
    this.crackle = f();
    this.form = f().fill(-1);
    this.sx = f();
    this.sy = f();
    this.tx = f();
    this.ty = f();
    this.hold = f();
    this.cr = f();
    this.cg = f();
    this.cb = f();
    const g = new BufferGeometry();
    this.aPos = new BufferAttribute(new Float32Array(n * 3), 3);
    this.aSize = new BufferAttribute(f(), 1);
    this.aAlpha = new BufferAttribute(f(), 1);
    this.aColor = new BufferAttribute(new Float32Array(n * 3), 3);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setAttribute('aColor', this.aColor);
    this.mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uScale: { value: 500 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 70;
    stage.scene.add(this.points);
    this.flashes = new Glows(10, stage.lightScene);
    this.halos = new Glows(10, stage.scene, 3.5);
    this.halos.mesh.renderOrder = 69;
    this.flashAmp = new Float32Array(10);
    stage.onResize(() => {
      const h = stage.renderer.getDrawingBufferSize(new Vector2()).y;
      this.mat.uniforms.uScale!.value = h / (2 * Math.tan(MathUtils.degToRad(stage.camera.fov / 2)));
    });
    stage.onFrame((dt) => this.update(dt));
  }

  // ---------- particles ----------

  private spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: Color,
    o: { heat?: number; drag?: number; grav?: number; trail?: number; strobe?: boolean; split?: number; crackle?: number } = {},
  ): number {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.max[i] = life;
    this.size0[i] = size;
    this.heat[i] = o.heat ?? 2.4;
    this.drag[i] = o.drag ?? 1.2;
    this.grav[i] = o.grav ?? 1;
    this.trail[i] = o.trail ?? 0;
    this.trailT[i] = 0;
    this.strobe[i] = o.strobe ? 1 : 0;
    this.split[i] = o.split ?? 0;
    this.crackle[i] = o.crackle ?? 0;
    this.form[i] = -1;
    this.cr[i] = color.r;
    this.cg[i] = color.g;
    this.cb[i] = color.b;
    return i;
  }

  private flash(x: number, y: number, color: Color, amp: number, size: number): void {
    const k = this.nextFlash++ % this.flashAmp.length;
    this.flashes.color(k, color);
    this.halos.color(k, color);
    this.flashes.set(k, x, y, this.z, size * 3.2, 0);
    this.halos.set(k, x, y, this.z, size * 1.4, 0);
    this.flashAmp[k] = amp;
  }

  // ---------- public API ----------

  /** A rocket from the ground to (tx, ty), bursting into `shell`. */
  launch(x0: number, tx: number, ty: number, shell: Shell = SHELLS[Math.floor(Math.random() * SHELLS.length)]!, colors?: [Color, Color]): void {
    const t = 1.05 + Math.random() * 0.25;
    const vy = (ty - this.groundY) / t + 0.5 * 2.2 * this.u * t;
    this.rockets.push({ x: x0, y: this.groundY, vx: (tx - x0) / t, vy, ty, shell, colors: colors ?? [randomColor(), randomColor()], form: null });
    this.onLaunch?.(x0);
  }

  /** A rocket whose stars fly into the given picture (text, a face) and hold it for a moment. */
  launchForm(x0: number, cx: number, cy: number, pts: FormPoint[], heat = 1.7): void {
    const t = 1.2;
    const vy = (cy - this.groundY) / t + 0.5 * 2.2 * this.u * t;
    this.rockets.push({ x: x0, y: this.groundY, vx: (cx - x0) / t, vy, ty: cy, shell: 'peony', colors: [GOLD, WHITE], form: pts, formHeat: heat });
    this.onLaunch?.(x0);
  }

  burst(x: number, y: number, shell: Shell, colors: [Color, Color] = [randomColor(), randomColor()]): void {
    const u = this.u;
    const [a, b] = colors;
    const sphere = (n: number, speed: number, f: (vx: number, vy: number, i: number) => void) => {
      for (let i = 0; i < n; i++) {
        // A sphere seen from the front: denser in the middle, like a real shell.
        const th = Math.random() * Math.PI * 2;
        const cz = Math.random() * 2 - 1;
        const r = Math.sqrt(1 - cz * cz);
        const s = speed * (0.92 + Math.random() * 0.16);
        f(Math.cos(th) * r * s, Math.sin(th) * r * s, i);
      }
    };
    let big = false;
    switch (shell) {
      case 'peony':
        sphere(170, 4.4 * u, (vx, vy, i) => this.spawn(x, y, vx, vy, 1.5 + Math.random() * 0.6, 0.075 * u, i % 5 === 0 ? b : a, { heat: 3 }));
        break;
      case 'chrysanthemum':
        sphere(130, 4.6 * u, (vx, vy) => this.spawn(x, y, vx, vy, 1.9 + Math.random() * 0.5, 0.07 * u, a, { heat: 3, trail: 0.025 }));
        break;
      case 'willow':
        big = true;
        sphere(120, 3.4 * u, (vx, vy) =>
          this.spawn(x, y, vx, vy + 0.6 * u, 3.4 + Math.random() * 1.2, 0.065 * u, GOLD, { heat: 2.4, drag: 1.9, grav: 0.55, trail: 0.03 }),
        );
        break;
      case 'palm': {
        const arms = 8 + Math.floor(Math.random() * 3);
        for (let i = 0; i < arms; i++) {
          const th = (i / arms) * Math.PI * 2 + Math.random() * 0.2;
          this.spawn(x, y, Math.cos(th) * 4.8 * u, Math.sin(th) * 4.8 * u + 0.8 * u, 2.2, 0.16 * u, a, { heat: 3.4, drag: 1.4, grav: 0.8, trail: 0.012 });
        }
        sphere(40, 1.6 * u, (vx, vy) => this.spawn(x, y, vx, vy, 1.0, 0.05 * u, GOLD, { heat: 2.6 }));
        big = true;
        break;
      }
      case 'ring': {
        // A tilted ring, sometimes with a second colour inside.
        const tilt = 0.35 + Math.random() * 0.65;
        const rot = Math.random() * Math.PI;
        for (let i = 0; i < 110; i++) {
          const th = (i / 110) * Math.PI * 2;
          const ex = Math.cos(th) * 4.6 * u;
          const ey = Math.sin(th) * 4.6 * u * tilt;
          this.spawn(x, y, ex * Math.cos(rot) - ey * Math.sin(rot), ex * Math.sin(rot) + ey * Math.cos(rot), 1.6, 0.085 * u, a, { heat: 3.2 });
        }
        sphere(50, 1.9 * u, (vx, vy) => this.spawn(x, y, vx, vy, 1.4, 0.06 * u, b, { heat: 2.8 }));
        break;
      }
      case 'crossette':
        for (let i = 0; i < 12; i++) {
          const th = (i / 12) * Math.PI * 2;
          this.spawn(x, y, Math.cos(th) * 3.8 * u, Math.sin(th) * 3.8 * u, 1.4, 0.12 * u, a, { heat: 3, trail: 0.02, split: 0.6 });
        }
        break;
      case 'strobe':
        sphere(140, 3.8 * u, (vx, vy) => this.spawn(x, y, vx, vy, 2.6 + Math.random(), 0.08 * u, WHITE, { heat: 3.4, drag: 1.6, grav: 0.6, strobe: true }));
        break;
      case 'crackle':
        sphere(130, 4 * u, (vx, vy) =>
          this.spawn(x, y, vx, vy, 1.3 + Math.random() * 0.4, 0.07 * u, GOLD, { heat: 2.8, crackle: 0.7 + Math.random() * 0.6 }),
        );
        break;
      case 'double':
        big = true;
        sphere(120, 2.6 * u, (vx, vy) => this.spawn(x, y, vx, vy, 1.6, 0.07 * u, a, { heat: 3 }));
        sphere(160, 5.2 * u, (vx, vy) => this.spawn(x, y, vx, vy, 1.8, 0.075 * u, b, { heat: 3 }));
        break;
    }
    this.flash(x, y, a, big ? 0.9 : 0.7, 5 * u);
    this.onBurst?.(shell, x, big);
  }

  /** Stars fly from (cx, cy) into the picture, hold, then fall away as glitter. */
  burstForm(cx: number, cy: number, pts: FormPoint[], hold = 3, heat = 1.7): void {
    for (const p of pts) {
      // Heat kept low enough that bloom leaves the colour in (a hotter spark burns to white).
      const i = this.spawn(cx, cy, 0, 0, 99, 0.07 * this.u * (0.8 + Math.random() * 0.5), p.color, { heat });
      this.form[i] = -Math.random() * 0.18;
      this.sx[i] = cx;
      this.sy[i] = cy;
      this.tx[i] = cx + p.x;
      this.ty[i] = cy + p.y;
      this.hold[i] = hold + Math.random() * 0.6;
    }
    this.flash(cx, cy, GOLD, 1, 7 * this.u);
    this.onBurst?.('double', cx, true);
  }

  /** তুবড়ি: a fountain of gold and white sparks from the ground. */
  fountain(x: number, y: number, seconds = 6): void {
    this.emitters.push({ kind: 'fountain', x, y, t: 0, life: seconds, angle: 0, color: GOLD });
  }

  /** চরকি: a ground spinner throwing coloured sparks as it turns. */
  spinner(x: number, y: number, seconds = 6): void {
    this.emitters.push({ kind: 'spinner', x, y, t: 0, life: seconds, angle: 0, color: randomColor() });
  }

  get busy(): boolean {
    return this.rockets.length > 0 || this.emitters.length > 0;
  }

  // ---------- frame ----------

  private update(dt: number): void {
    this.time += dt;
    const u = this.u;
    const g = 2.2 * u;

    // Rockets: a bright head with a falling tail of sparks.
    for (const r of this.rockets) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy -= g * dt;
      for (let k = 0; k < 2; k++) {
        this.spawn(r.x + (Math.random() - 0.5) * 0.02 * u, r.y, (Math.random() - 0.5) * 0.3 * u, -0.6 * u, 0.4 + Math.random() * 0.3, 0.05 * u, GOLD, { heat: 2.2, drag: 2 });
      }
      if (r.vy <= 0.15 * u || r.y >= r.ty) {
        if (r.form) this.burstForm(r.x, r.y, r.form, 3, r.formHeat);
        else this.burst(r.x, r.y, r.shell, r.colors);
        r.vy = -999;
      }
    }
    this.rockets = this.rockets.filter((r) => r.vy > -999);

    // Ground pieces.
    for (const e of this.emitters) {
      e.t += dt;
      const fade = Math.min(1, e.t * 3, (e.life - e.t) * 1.5);
      if (e.kind === 'fountain') {
        const n = Math.round(240 * dt * fade);
        for (let k = 0; k < n; k++) {
          // A real tubri throws its sparks two or three times a man's height, in a narrow plume that breathes.
          const th = Math.PI / 2 + (Math.random() - 0.5) * 0.42;
          const s = (4.6 + Math.random() * 2.6) * u * (0.8 + 0.2 * Math.sin(e.t * 7));
          this.spawn(e.x, e.y, Math.cos(th) * s, Math.sin(th) * s, 1.1 + Math.random() * 0.8, 0.05 * u, Math.random() < 0.25 ? WHITE : GOLD, { heat: 2.8, drag: 0.6, grav: 1.1 });
        }
        if (Math.random() < dt * 4) this.onCrackle?.(e.x);
        this.flashAmp[0] = Math.max(this.flashAmp[0]!, 0.35 * fade);
        this.flashes.set(0, e.x, e.y + 1.5 * u, this.z, 7 * u, 0);
        this.flashes.color(0, GOLD);
      } else {
        e.angle += dt * 13;
        if (Math.random() < dt * 0.6) e.color = randomColor();
        const n = Math.round(200 * dt * fade);
        for (let k = 0; k < n; k++) {
          const a = e.angle + (k / n) * 0.6;
          const rr = 0.18 * u;
          const ox = Math.cos(a) * rr;
          const oy = Math.sin(a) * rr * 0.4;
          const s = (1.6 + Math.random() * 1.2) * u;
          // Thrown off along the tangent of the spin.
          this.spawn(e.x + ox, e.y + oy + 0.05 * u, -Math.sin(a) * s, Math.cos(a) * s * 0.4 + 0.6 * u, 0.6 + Math.random() * 0.4, 0.05 * u, Math.random() < 0.3 ? WHITE : e.color, { heat: 3, drag: 1.4, grav: 0.9 });
        }
        this.flashAmp[1] = Math.max(this.flashAmp[1]!, 0.3 * fade);
        this.flashes.set(1, e.x, e.y + 0.6 * u, this.z, 5 * u, 0);
        this.flashes.color(1, e.color);
      }
    }
    this.emitters = this.emitters.filter((e) => e.t < e.life);

    // Stars.
    const t = this.time;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i]! <= 0) {
        this.aAlpha.setX(i, 0);
        continue;
      }
      let alpha: number;
      let size = this.size0[i]!;
      const fm = this.form[i]!;
      if (fm > -1 && (fm < 0 || this.hold[i]! > 0 || fm < 1.6)) {
        // Forming a picture: ease from the burst to the target, then hold and twinkle.
        const ft = (this.form[i] = fm + dt);
        if (ft <= 0) {
          this.aAlpha.setX(i, 0);
          continue;
        }
        const k = Math.min(1, ft / 1.4);
        const e = 1 - Math.pow(1 - k, 4);
        this.px[i] = this.sx[i]! + (this.tx[i]! - this.sx[i]!) * e;
        this.py[i] = this.sy[i]! + (this.ty[i]! - this.sy[i]!) * e - Math.sin(k * Math.PI) * 0.4 * u * (1 - e);
        if (k >= 1) this.hold[i] = this.hold[i]! - dt;
        if (k >= 1 && this.hold[i]! <= 0) {
          // Let go: fall away as glitter.
          this.form[i] = -1;
          this.life[i] = this.max[i] = 1.6 + Math.random() * 1.2;
          this.vx[i] = (Math.random() - 0.5) * 0.5 * u;
          this.vy[i] = (Math.random() - 0.2) * 0.4 * u;
          this.drag[i] = 1.5;
          this.grav[i] = 0.45;
        }
        alpha = this.heat[i]! * (0.75 + 0.25 * Math.sin(t * 9 + i * 1.7));
      } else {
        this.life[i] = this.life[i]! - dt;
        const d = Math.exp(-this.drag[i]! * dt);
        this.vx[i] = this.vx[i]! * d;
        this.vy[i] = this.vy[i]! * d - g * this.grav[i]! * dt;
        this.px[i] = this.px[i]! + this.vx[i]! * dt;
        this.py[i] = this.py[i]! + this.vy[i]! * dt;
        const k = Math.max(0, this.life[i]! / this.max[i]!);
        alpha = (k < 0.35 ? k / 0.35 : 1) * this.heat[i]! * (0.8 + 0.2 * Math.sin(t * 40 + i * 7.1));
        size *= 0.45 + 0.55 * k;
        if (this.strobe[i] && Math.sin(t * 22 + i * 3.3) < 0.2) alpha *= 0.08;
        // Trails: small falling sparks left behind.
        if (this.trail[i]! > 0) {
          this.trailT[i] = this.trailT[i]! - dt;
          if (this.trailT[i]! <= 0) {
            this.trailT[i] = this.trail[i]!;
            this.tmpC.setRGB(this.cr[i]!, this.cg[i]!, this.cb[i]!).lerp(GOLD, 0.5);
            this.spawn(this.px[i]!, this.py[i]!, this.vx[i]! * 0.1, this.vy[i]! * 0.1 - 0.2 * u, 0.5 + Math.random() * 0.3, this.size0[i]! * 0.55, this.tmpC, { heat: 1.8, drag: 2, grav: 0.4 });
          }
        }
        // Crossette: each comet splits into four.
        if (this.split[i]! > 0 && this.max[i]! - this.life[i]! >= this.split[i]!) {
          this.split[i] = 0;
          this.tmpC.setRGB(this.cr[i]!, this.cg[i]!, this.cb[i]!);
          const base = Math.atan2(this.vy[i]!, this.vx[i]!);
          for (let q = 0; q < 4; q++) {
            const th = base + Math.PI / 4 + (q * Math.PI) / 2;
            this.spawn(this.px[i]!, this.py[i]!, Math.cos(th) * 2.4 * u, Math.sin(th) * 2.4 * u, 0.9, this.size0[i]! * 0.7, this.tmpC, { heat: 3, trail: 0.03 });
          }
          this.life[i] = 0;
        }
        // Crackle: the star pops into a little white flash.
        if (this.crackle[i]! > 0 && this.max[i]! - this.life[i]! >= this.crackle[i]!) {
          this.crackle[i] = 0;
          for (let q = 0; q < 5; q++) {
            this.spawn(this.px[i]!, this.py[i]!, (Math.random() - 0.5) * 0.9 * u, (Math.random() - 0.5) * 0.9 * u, 0.12 + Math.random() * 0.1, this.size0[i]! * 1.3, WHITE, { heat: 4, drag: 4 });
          }
          this.life[i] = 0;
          if (Math.random() < 0.08) this.onCrackle?.(this.px[i]!);
        }
      }
      this.aPos.setXYZ(i, this.px[i]!, this.py[i]!, this.z);
      this.aAlpha.setX(i, alpha);
      this.aSize.setX(i, size);
      this.aColor.setXYZ(i, this.cr[i]!, this.cg[i]!, this.cb[i]!);
    }
    this.aPos.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;

    for (let k = 0; k < this.flashAmp.length; k++) {
      const a = this.flashAmp[k]!;
      this.flashes.amp(k, a);
      this.halos.amp(k, a * 0.35);
      this.flashAmp[k] = Math.max(0, a - dt * (k < 2 ? 3 : 1.6));
    }
    this.flashes.commit();
    this.halos.commit();
  }
}

/** Points that draw a line of text in the sky (rendered with the page's Bengali font, then sampled). */
export async function textPoints(text: string, width: number, color = GOLD, step = 4): Promise<FormPoint[]> {
  try {
    await document.fonts.load('200px "Tiro Bangla"');
  } catch {
    /* System Bengali font. */
  }
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = '200px "Tiro Bangla", serif';
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w;
  c.height = 300;
  ctx.font = '200px "Tiro Bangla", serif';
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, 150);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const pts: FormPoint[] = [];
  const s = width / w;
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      if (d[(y * c.width + x) * 4 + 3]! > 140) pts.push({ x: (x - w / 2) * s, y: (150 - y) * s, color });
    }
  }
  return pts;
}

/**
 * Points that draw a picture in sparks: its bright, coloured features (crown, eyes, tongue, ornaments) in their own
 * colours, and its edges in gold, so a dark face still reads.
 */
export async function imagePoints(
  url: string,
  crop: { u0: number; v0: number; u1: number; v1: number },
  height: number,
  max = 2600,
): Promise<FormPoint[]> {
  // onload rather than decode(): decode() can wait forever in a background tab.
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
  const sw = Math.round(img.width * (crop.u1 - crop.u0));
  const sh = Math.round(img.height * (crop.v1 - crop.v0));
  const W = 180;
  const H = Math.round((W * sh) / sw);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, img.width * crop.u0, img.height * crop.v0, sw, sh, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return d[i + 3]! < 60 ? 0 : (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
  };
  const cand: Array<FormPoint & { w: number }> = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3]! < 60) continue;
      const r = d[i]! / 255;
      const g = d[i + 1]! / 255;
      const b = d[i + 2]! / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const gx = lum(x + 1, y) - lum(x - 1, y);
      const gy = lum(x, y + 1) - lum(x, y - 1);
      const edge = Math.hypot(gx, gy);
      // Ma's blue skin is dark, so it gets its own faint fill; without it only the crown and eyes would show.
      const skin = b > r + 0.06 && b >= g && l > 0.07 && l < 0.45;
      // Pale plaster (the crown's white lacework) only counts at its edges, so it reads as an outline, not a blob.
      const w = Math.max(l > 0.45 && sat > 0.18 ? l : 0, sat > 0.35 ? sat : 0, edge > 0.18 ? edge * 1.6 : 0, skin ? 0.3 : 0);
      if (w <= 0) continue;
      const m = Math.max(r, g, b, 0.001);
      const color = skin && edge <= 0.18 ? SKIN : edge > 0.18 && l < 0.45 && sat < 0.35 ? GOLD : new Color(r / m, g / m, b / m);
      cand.push({ x: (x / W - 0.5) * (height * W) / H, y: (0.5 - y / H) * height, color, w });
    }
  }
  // The strongest features (eyes, tongue, ornaments) for certain, then an even sample of the rest, so the bright crown
  // cannot use up the whole budget.
  cand.sort((a, b) => b.w - a.w);
  const sure = Math.floor(max * 0.35);
  const rest = cand.slice(sure);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  const keep = cand.slice(0, sure).concat(rest.slice(0, max - sure));
  return keep.map(({ x, y, color }) => ({ x: x + (Math.random() - 0.5) * height * 0.004, y: y + (Math.random() - 0.5) * height * 0.004, color }));
}
