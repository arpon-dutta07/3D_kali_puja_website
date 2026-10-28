import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, MathUtils, Points, ShaderMaterial, Vector2 } from 'three';
import type { Stage } from './stage';

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
    float g = exp(-d * 3.0);
    gl_FragColor = vec4(vColor * g * vAlpha, 1.0);
  }
`;

export interface SparkInit {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz?: number;
  life: number;
  size: number;
  color: Color;
  /** Brightness multiplier (HDR, so sparks bloom). */
  heat?: number;
}

/**
 * CPU particles drawn as soft additive points: embers, the tubri fountain, sparkler sparks, rocket bursts.
 * Oldest particles are reused when the pool is full.
 */
export class Sparks {
  readonly points: Points;
  gravity = -2.2;
  drag = 0.6;
  /** Sideways wobble (embers drifting up). */
  wander = 0;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size0: Float32Array;
  private heat: Float32Array;
  private aSize: BufferAttribute;
  private aAlpha: BufferAttribute;
  private aColor: BufferAttribute;
  private aPos: BufferAttribute;
  private next = 0;
  private mat: ShaderMaterial;

  constructor(
    stage: Stage,
    capacity: number,
    parent = stage.scene,
  ) {
    this.n = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity).fill(1);
    this.size0 = new Float32Array(capacity);
    this.heat = new Float32Array(capacity);
    const g = new BufferGeometry();
    this.aPos = new BufferAttribute(this.pos, 3);
    this.aSize = new BufferAttribute(new Float32Array(capacity), 1);
    this.aAlpha = new BufferAttribute(new Float32Array(capacity), 1);
    this.aColor = new BufferAttribute(new Float32Array(capacity * 3), 3);
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
      blending: AdditiveBlending,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 60;
    parent.add(this.points);
    stage.onResize(() => {
      const h = stage.renderer.getDrawingBufferSize(new Vector2()).y;
      this.mat.uniforms.uScale!.value = h / (2 * Math.tan(MathUtils.degToRad(stage.camera.fov / 2)));
    });
    stage.onFrame((dt, time) => this.update(dt, time));
  }

  emit(s: SparkInit): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = s.x;
    this.pos[i * 3 + 1] = s.y;
    this.pos[i * 3 + 2] = s.z;
    this.vel[i * 3] = s.vx;
    this.vel[i * 3 + 1] = s.vy;
    this.vel[i * 3 + 2] = s.vz ?? 0;
    this.life[i] = s.life;
    this.max[i] = s.life;
    this.size0[i] = s.size;
    this.heat[i] = s.heat ?? 1;
    this.aColor.setXYZ(i, s.color.r, s.color.g, s.color.b);
  }

  clear(): void {
    this.life.fill(0);
  }

  private update(dt: number, time: number): void {
    const drag = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i]! <= 0) {
        this.aAlpha.setX(i, 0);
        continue;
      }
      this.life[i] = this.life[i]! - dt;
      const k = i * 3;
      this.vel[k] = this.vel[k]! * drag + (this.wander ? Math.sin(time * 2.1 + i) * this.wander * dt : 0);
      this.vel[k + 1] = this.vel[k + 1]! * drag + this.gravity * dt;
      this.vel[k + 2] = this.vel[k + 2]! * drag;
      this.pos[k] = this.pos[k]! + this.vel[k]! * dt;
      this.pos[k + 1] = this.pos[k + 1]! + this.vel[k + 1]! * dt;
      this.pos[k + 2] = this.pos[k + 2]! + this.vel[k + 2]! * dt;
      const t = Math.max(0, this.life[i]! / this.max[i]!);
      // Bright at birth, a twinkle on the way, gone at the end.
      const tw = 0.75 + 0.25 * Math.sin(time * 40 + i * 7.1);
      this.aAlpha.setX(i, t * t * this.heat[i]! * tw);
      this.aSize.setX(i, this.size0[i]! * (0.4 + 0.6 * t));
    }
    this.aPos.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }
}
