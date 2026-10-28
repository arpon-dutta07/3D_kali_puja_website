import { Color, ShaderMaterial, Texture, Vector2 } from 'three';
import type { Stage } from './stage';

const vertex = /* glsl */ `
  uniform vec2 uRepeat;
  varying vec2 vUv;
  varying vec2 vUv0;
  void main() {
    vUv0 = uv;
    vUv = uv * uRepeat;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D map2;
  uniform float uMix;
  uniform float uMixPatchy;
  uniform sampler2D uLight;
  uniform vec2 uRes;
  uniform vec3 uAmbient;
  uniform float uGain;
  uniform float uOpacity;
  uniform float uRise;
  uniform float uRiseSoft;
  uniform float uRiseGain;
  uniform vec3 uRiseColor;
  uniform vec3 uFlood;
  uniform float uEmissive;
  varying vec2 vUv;
  varying vec2 vUv0;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec4 a = texture2D(map, vUv);
    if (uMix > 0.0) {
      vec4 b = texture2D(map2, vUv);
      float m = uMix;
      if (uMixPatchy > 0.0) {
        // Lights come on in patches across the picture rather than as one cross-fade.
        float n = vnoise(vUv0 * 7.0) * 0.55 + vnoise(vUv0 * 29.0) * 0.45;
        m = smoothstep(n - 0.08, n + 0.08, uMix * 1.25 - 0.12);
      }
      a = mix(a, b, m);
    }
    vec3 L = texture2D(uLight, gl_FragCoord.xy / uRes).rgb * uGain;
    float rise = (1.0 - smoothstep(uRise - uRiseSoft, uRise + 0.03, vUv0.y)) * uRiseGain;
    float luma = dot(a.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 col = a.rgb * (uAmbient + L + uRiseColor * rise + uFlood);
    col += a.rgb * smoothstep(0.5, 0.85, luma) * uEmissive;
    gl_FragColor = vec4(col, a.a * uOpacity);
  }
`;

export interface LitOptions {
  ambient?: number | string;
  gain?: number;
  opacity?: number;
  repeat?: [number, number];
  emissive?: number;
  transparent?: boolean;
}

/**
 * An image lit by the stage's light map: colour = image × (ambient + nearby lamp light + a bottom-up "rise" light +
 * a flat flood). `map2` + `uMix` cross-fade to a second, aligned image (Ma with the garland, the city with its lights).
 */
export function litMaterial(stage: Stage, map: Texture, opts: LitOptions = {}): ShaderMaterial {
  const ambient = typeof opts.ambient === 'string' ? new Color(opts.ambient) : new Color().setScalar(opts.ambient ?? 0.05);
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: opts.transparent ?? true,
    depthWrite: !(opts.transparent ?? true),
    uniforms: {
      map: { value: map },
      map2: { value: map },
      uMix: { value: 0 },
      uMixPatchy: { value: 0 },
      uLight: stage.lit.uLight,
      uRes: stage.lit.uRes,
      uAmbient: { value: ambient },
      uGain: { value: opts.gain ?? 1 },
      uOpacity: { value: opts.opacity ?? 1 },
      uRise: { value: -0.2 },
      uRiseSoft: { value: 0.35 },
      uRiseGain: { value: 0 },
      uRiseColor: { value: new Color('#ffb070') },
      uFlood: { value: new Color(0, 0, 0) },
      uEmissive: { value: opts.emissive ?? 0 },
      uRepeat: { value: new Vector2(...(opts.repeat ?? [1, 1])) },
    },
  });
}

/** Typed access to the uniforms above. */
export function lu(m: ShaderMaterial): {
  map: { value: Texture };
  map2: { value: Texture };
  uMix: { value: number };
  uMixPatchy: { value: number };
  uAmbient: { value: Color };
  uGain: { value: number };
  uOpacity: { value: number };
  uRise: { value: number };
  uRiseSoft: { value: number };
  uRiseGain: { value: number };
  uRiseColor: { value: Color };
  uFlood: { value: Color };
  uEmissive: { value: number };
  uRepeat: { value: Vector2 };
} {
  return m.uniforms as never;
}
