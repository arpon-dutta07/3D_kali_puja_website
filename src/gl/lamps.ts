import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  Mesh,
  ShaderMaterial,
  Texture,
  Vector3,
} from 'three';
import { config } from '../config';
import { billboardGeometry, Glows } from './glows';
import type { Stage } from './stage';

const vertex = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSize;
  attribute float aLit;
  attribute float aSeed;
  uniform vec2 uQuad;     // quad width, height in lamp sizes
  uniform vec2 uOffset;   // quad centre offset in lamp sizes
  varying vec2 vUv;
  varying float vLit;
  varying float vSeed;
  void main() {
    vUv = uv;
    vLit = aLit;
    vSeed = aSeed;
    vec4 mv = viewMatrix * vec4(aPos, 1.0);
    mv.xy += (position.xy * uQuad + uOffset) * aSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMaster;
  uniform vec3 uOuter;
  uniform vec3 uMid;
  uniform vec3 uCore;
  varying vec2 vUv;
  varying float vLit;
  varying float vSeed;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    if (vLit < 0.002) discard;
    float t = uTime + vSeed * 31.0;
    vec2 p = vUv - vec2(0.5, 0.18);
    float h = clamp(p.y / 0.7, 0.0, 1.0);
    p.x += (vnoise(vec2(vUv.y * 2.5 - t * 2.2, t * 0.7)) - 0.5) * 0.16 * h;
    float height = 0.64 * (0.88 + 0.14 * vnoise(vec2(t * 3.1, 2.0))) * (0.35 + 0.65 * vLit);
    float width = 0.15 * (1.0 - 0.72 * clamp(p.y / max(height, 0.01), 0.0, 1.0));
    vec2 q = vec2(p.x / max(width, 0.001), p.y < 0.0 ? p.y / 0.09 : p.y / max(height, 0.01));
    float d = length(q);
    float body = 1.0 - smoothstep(0.5, 1.0, d);
    float core = 1.0 - smoothstep(0.0, 0.6, length(vec2(q.x * 1.3, (q.y - 0.12) * 1.7)));
    vec3 col = mix(uOuter, uMid, smoothstep(0.15, 0.85, 1.0 - d)) * body + uCore * core * 2.4;
    gl_FragColor = vec4(col * vLit * uMaster, body * vLit * uMaster);
  }
`;

const bowlFragment = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D uLight;
  uniform vec2 uRes;
  uniform float uAmbient;
  uniform float uTime;
  uniform vec3 uWarm;
  varying vec2 vUv;
  varying float vLit;
  varying float vSeed;
  void main() {
    vec4 a = texture2D(map, vUv);
    if (a.a < 0.02) discard;
    vec3 L = texture2D(uLight, gl_FragCoord.xy / uRes).rgb;
    // Its own flame lights the inside and the rim from above.
    float self = vLit * (0.85 + 0.15 * sin(uTime * 9.0 + vSeed * 40.0)) * smoothstep(0.1, 0.9, vUv.y);
    vec3 col = a.rgb * (uAmbient + L * 0.9 + uWarm * self * 1.1);
    gl_FragColor = vec4(col, a.a);
  }
`;

export interface LampOptions {
  /** The clay lamp / candle picture. null = a flame with nothing under it (the one you carry). */
  bowl: Texture | null;
  /** Bowl quad width / height (lamp size = bowl width). */
  bowlAspect?: number;
  /** Flame base height above the lamp position, in lamp sizes. */
  flameLift?: number;
  /** Flame sideways from the lamp centre, in lamp sizes (a prodip's wick sits in its spout). */
  flameX?: number;
  /** Flame quad height in lamp sizes. */
  flameSize?: number;
  /** Light radius in lamp sizes, and its strength. */
  light?: number;
  lightAmp?: number;
  /** Visible halo (blooms) in lamp sizes and strength. */
  halo?: number;
  haloAmp?: number;
  ambient?: number;
}

/**
 * Many lamps drawn with three instanced draws (bowls, flames, halos) plus one in the light pass. `ignite(i)` fades a
 * flame in; each lamp's light flickers on its own.
 */
export class LampField {
  readonly count: number;
  readonly pos: Vector3[];
  readonly size: Float32Array;
  /** Current flame 0..1 (animated). */
  readonly lit: Float32Array;
  private want: Float32Array;
  private wait: Float32Array;
  private seed: Float32Array;
  private aLitFlame: InstancedBufferAttribute;
  private aLitBowl: InstancedBufferAttribute | null = null;
  private aPosAttrs: InstancedBufferAttribute[] = [];
  private aSizeAttrs: InstancedBufferAttribute[] = [];
  private lights: Glows;
  private halos: Glows;
  private flameMat: ShaderMaterial;
  private bowlMat: ShaderMaterial | null = null;
  readonly meshes: Mesh[] = [];
  /** Multiplies every light (for fades). */
  master = 1;
  /** Called the moment a lamp starts to catch. */
  onIgnite: ((i: number) => void) | null = null;
  private o: Required<Omit<LampOptions, 'bowl'>>;

  constructor(
    private stage: Stage,
    positions: Vector3[],
    sizes: number | number[],
    opts: LampOptions,
  ) {
    this.count = positions.length;
    this.pos = positions.map((p) => p.clone());
    this.size = Float32Array.from(positions, (_, i) => (typeof sizes === 'number' ? sizes : (sizes[i] ?? 1)));
    this.lit = new Float32Array(this.count);
    this.want = new Float32Array(this.count);
    this.wait = new Float32Array(this.count);
    this.seed = Float32Array.from(positions, (_, i) => ((i * 0.6180339) % 1) + Math.sin(i * 12.9) * 0.05);
    this.o = {
      bowlAspect: opts.bowlAspect ?? 1,
      flameLift: opts.flameLift ?? 0.12,
      flameX: opts.flameX ?? 0,
      flameSize: opts.flameSize ?? 1.1,
      light: opts.light ?? 7,
      lightAmp: opts.lightAmp ?? 0.55,
      halo: opts.halo ?? 1.6,
      haloAmp: opts.haloAmp ?? 0.18,
      ambient: opts.ambient ?? 0.06,
    };

    const n = this.count;
    const posArr = new Float32Array(n * 3);
    this.pos.forEach((p, i) => p.toArray(posArr, i * 3));
    const seedAttr = new InstancedBufferAttribute(this.seed, 1);
    const makeGeo = (lit: InstancedBufferAttribute) => {
      const g = billboardGeometry(n);
      const ap = new InstancedBufferAttribute(posArr.slice(), 3);
      const as = new InstancedBufferAttribute(this.size.slice(), 1);
      this.aPosAttrs.push(ap);
      this.aSizeAttrs.push(as);
      g.setAttribute('aPos', ap);
      g.setAttribute('aSize', as);
      g.setAttribute('aLit', lit);
      g.setAttribute('aSeed', seedAttr);
      return g;
    };

    if (opts.bowl) {
      this.aLitBowl = new InstancedBufferAttribute(new Float32Array(n), 1);
      const h = 1 / this.o.bowlAspect;
      this.bowlMat = new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: bowlFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          map: { value: opts.bowl },
          uLight: stage.lit.uLight,
          uRes: stage.lit.uRes,
          uAmbient: { value: this.o.ambient },
          uTime: { value: 0 },
          uWarm: { value: new Color(config.palette.amber) },
          uQuad: { value: [1, h] },
          uOffset: { value: [0, 0] },
        },
      });
      const bowl = new Mesh(makeGeo(this.aLitBowl), this.bowlMat);
      bowl.frustumCulled = false;
      bowl.renderOrder = 20;
      stage.scene.add(bowl);
      this.meshes.push(bowl);
    }

    this.aLitFlame = new InstancedBufferAttribute(new Float32Array(n), 1);
    const fs = this.o.flameSize;
    this.flameMat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: flameFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMaster: { value: 1 },
        uOuter: { value: new Color(config.palette.flameOuter) },
        uMid: { value: new Color(config.palette.amber) },
        uCore: { value: new Color(config.palette.flameCore) },
        uQuad: { value: [fs * 0.5, fs] },
        // The flame quad's base (uv.y 0.18) sits at flameLift.
        uOffset: { value: [this.o.flameX, this.o.flameLift + fs * (0.5 - 0.18)] },
      },
    });
    const flame = new Mesh(makeGeo(this.aLitFlame), this.flameMat);
    flame.frustumCulled = false;
    flame.renderOrder = 30;
    stage.scene.add(flame);
    this.meshes.push(flame);

    this.lights = new Glows(n, stage.lightScene);
    this.halos = new Glows(n, stage.scene, 4.5);
    this.lights.colorAll(config.palette.amber);
    this.halos.colorAll(config.palette.amber);
    this.meshes.push(this.halos.mesh);
    for (let i = 0; i < n; i++) this.placeGlows(i);
    this.lights.commit();
    this.halos.commit();

    stage.onFrame((dt, time) => this.update(dt, time));
  }

  private placeGlows(i: number): void {
    const p = this.pos[i]!;
    const s = this.size[i]!;
    const fx = p.x + this.o.flameX * s;
    const fy = p.y + (this.o.flameLift + this.o.flameSize * 0.25) * s;
    this.lights.set(i, fx, fy, p.z, this.o.light * s, 0);
    this.halos.set(i, fx, fy, p.z + 0.001, this.o.halo * s, 0);
  }

  get litCount(): number {
    let c = 0;
    for (let i = 0; i < this.count; i++) if (this.want[i]! > 0) c++;
    return c;
  }

  isLit(i: number): boolean {
    return this.want[i]! > 0;
  }

  ignite(i: number, delay = 0): boolean {
    if (this.want[i]! > 0) return false;
    this.want[i] = 1;
    this.wait[i] = delay;
    if (delay <= 0) this.onIgnite?.(i);
    return true;
  }

  out(i: number): void {
    this.want[i] = 0;
    this.wait[i] = 0;
  }

  setAll(on: boolean, instant = false): void {
    for (let i = 0; i < this.count; i++) {
      this.want[i] = on ? 1 : 0;
      this.wait[i] = 0;
      if (instant) this.lit[i] = on ? 1 : 0;
    }
  }

  setPosition(i: number, p: Vector3): void {
    this.pos[i]!.copy(p);
    for (const a of this.aPosAttrs) {
      a.setXYZ(i, p.x, p.y, p.z);
      a.needsUpdate = true;
    }
    this.placeGlows(i);
  }

  setSize(i: number, s: number): void {
    this.size[i] = s;
    for (const a of this.aSizeAttrs) {
      a.setX(i, s);
      a.needsUpdate = true;
    }
    this.placeGlows(i);
  }

  /** Where the flame sits (for hit tests and sparks). */
  flamePoint(i: number, out = new Vector3()): Vector3 {
    const p = this.pos[i]!;
    return out.set(p.x + this.o.flameX * this.size[i]!, p.y + (this.o.flameLift + this.o.flameSize * 0.2) * this.size[i]!, p.z);
  }

  setVisible(v: boolean): void {
    for (const m of this.meshes) m.visible = v;
    this.lights.mesh.visible = v;
  }

  private update(dt: number, time: number): void {
    const rate = dt / config.lamp.igniteSeconds;
    const fl = config.lamp.flicker;
    for (let i = 0; i < this.count; i++) {
      if (this.wait[i]! > 0) {
        this.wait[i] = this.wait[i]! - dt;
        if (this.wait[i]! <= 0) this.onIgnite?.(i);
        continue;
      }
      const w = this.want[i]!;
      let l = this.lit[i]!;
      l = w > l ? Math.min(w, l + rate) : Math.max(w, l - rate * 1.5);
      this.lit[i] = l;
      this.aLitFlame.setX(i, l);
      this.aLitBowl?.setX(i, l);
      const s = this.seed[i]! * 40;
      const f = 1 + fl * (Math.sin(time * 9.1 + s) * 0.5 + Math.sin(time * 5.3 + s * 0.31) * 0.35 + Math.sin(time * 17.0 + s * 1.7) * 0.15);
      // Catching flames flare a little before they settle.
      const flare = 1 + 0.6 * Math.max(0, 1 - Math.abs(l - 0.6) * 3) * (l < 1 ? 1 : 0);
      const amp = l * f * flare * this.master;
      this.lights.amp(i, amp * this.o.lightAmp);
      this.halos.amp(i, amp * this.o.haloAmp);
    }
    this.aLitFlame.needsUpdate = true;
    if (this.aLitBowl) this.aLitBowl.needsUpdate = true;
    this.lights.commit();
    this.halos.commit();
    this.flameMat.uniforms.uTime!.value = time;
    this.flameMat.uniforms.uMaster!.value = Math.min(1, this.master);
    if (this.bowlMat) this.bowlMat.uniforms.uTime!.value = time;
  }

  /** Every lamp's on-screen position (CSS px), reusing the given array. */
  screen(out: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const v = new Vector3();
    for (let i = 0; i < this.count; i++) {
      this.flamePoint(i, v).project(this.stage.camera);
      const o = (out[i] ??= { x: 0, y: 0 });
      o.x = (v.x * 0.5 + 0.5) * this.stage.width;
      o.y = (0.5 - v.y * 0.5) * this.stage.height;
    }
    return out;
  }
}
