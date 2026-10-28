import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  type Object3D,
} from 'three';

/** Camera-facing quad per instance; shared by glows, flames and lamp bowls. */
export function billboardGeometry(capacity: number): InstancedBufferGeometry {
  const base = new PlaneGeometry(1, 1);
  const g = new InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.getAttribute('position'));
  g.setAttribute('uv', base.getAttribute('uv'));
  g.instanceCount = capacity;
  return g;
}

export const glowVertex = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAmp;
  varying vec2 vUv;
  varying vec3 vCol;
  void main() {
    vUv = uv;
    vCol = aColor * aAmp;
    vec4 mv = viewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const glowFragment = /* glsl */ `
  uniform float uFalloff;
  varying vec2 vUv;
  varying vec3 vCol;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float g = max(exp(-dot(p, p) * uFalloff) - exp(-uFalloff), 0.0) / (1.0 - exp(-uFalloff));
    gl_FragColor = vec4(vCol * g, 1.0);
  }
`;

/**
 * Soft round lights. Put them in `stage.lightScene` to light the lit materials around them, or in `stage.scene` for a
 * visible halo that blooms.
 */
export class Glows {
  readonly mesh: Mesh;
  private aPos: InstancedBufferAttribute;
  private aSize: InstancedBufferAttribute;
  private aColor: InstancedBufferAttribute;
  private aAmp: InstancedBufferAttribute;

  constructor(
    readonly capacity: number,
    parent: Object3D,
    falloff = 3.2,
  ) {
    const g = billboardGeometry(capacity);
    this.aPos = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aSize = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.aColor = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    this.aAmp = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    g.setAttribute('aPos', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aColor', this.aColor);
    g.setAttribute('aAmp', this.aAmp);
    const m = new ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: { uFalloff: { value: falloff } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 50;
    parent.add(this.mesh);
  }

  set(i: number, x: number, y: number, z: number, size: number, amp: number): void {
    this.aPos.setXYZ(i, x, y, z);
    this.aSize.setX(i, size);
    this.aAmp.setX(i, amp);
  }

  amp(i: number, amp: number): void {
    this.aAmp.setX(i, amp);
  }

  color(i: number, c: Color | string): void {
    const col = typeof c === 'string' ? new Color(c) : c;
    this.aColor.setXYZ(i, col.r, col.g, col.b);
  }

  colorAll(c: Color | string): void {
    for (let i = 0; i < this.capacity; i++) this.color(i, c);
  }

  commit(): void {
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aAmp.needsUpdate = true;
  }
}
