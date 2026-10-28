import { gsap } from 'gsap';
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import {
  Color,
  HalfFloatType,
  LinearFilter,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { config } from '../config';
import { cappedDpr } from '../lib/device';
import { parallax } from '../lib/parallax';

type FrameFn = (dt: number, time: number) => void;

const stages = new Set<Stage>();
let tickerStarted = false;

let clock = 0;
let gsapOffset = 0;

/** One step of the whole page: parallax, gsap (driven from here so it shares this clock), then every visible stage. */
function step(dt: number, all = false): void {
  clock += dt;
  parallax.update(dt);
  gsap.updateRoot(gsapOffset + clock);
  for (const s of stages) if (all || s.onScreen) s.frame(dt, clock);
}

/** One requestAnimationFrame loop for the whole page; only stages that are on screen render. */
function startTicker(): void {
  if (tickerStarted) return;
  tickerStarted = true;
  gsap.ticker.remove(gsap.updateRoot);
  gsapOffset = gsap.ticker.time;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!document.hidden) step(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Debug: run `seconds` of the page synchronously (for checking frames when the tab isn't painting). */
export function advance(seconds: number, fps = 30): void {
  const n = Math.max(1, Math.round(seconds * fps));
  for (let i = 0; i < n; i++) step(1 / fps, true);
}

/**
 * A full-screen three.js scene with:
 * - a light map: every lamp's glow is first drawn into a small render target, and lit materials multiply their colour by
 *   it in screen space. That is what makes the lamps light the steps, the walls and Ma around them.
 * - bloom, ACES tone mapping, vignette and a little grain on top.
 */
export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  /** Glow sprites only; rendered into `lightTarget` each frame. */
  readonly lightScene = new Scene();
  readonly lightTarget: WebGLRenderTarget;
  readonly camera: PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  /** Shared by every LitMaterial on this stage (same object, so one update reaches all). */
  readonly lit = {
    uLight: { value: null as unknown },
    uRes: { value: new Vector2(1, 1) },
  };
  /** Extra bloom on top of the configured base, for climaxes. */
  bloomBoost = 0;
  onScreen = false;
  width = 1;
  height = 1;
  private frameFns: FrameFn[] = [];
  private resizeFns: Array<(w: number, h: number) => void> = [];
  private bufferSize = new Vector2();
  private clearColor: Color;

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: { fov?: number; background?: string } = {},
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.clearColor = new Color(opts.background ?? config.palette.night);
    this.renderer.setClearColor(this.clearColor, 1);
    this.camera = new PerspectiveCamera(opts.fov ?? 45, 1, 0.05, 200);

    this.lightTarget = new WebGLRenderTarget(4, 4, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    });
    this.lit.uLight.value = this.lightTarget.texture;

    this.composer = new EffectComposer(this.renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const b = config.bloom;
    this.bloom = new BloomEffect({
      intensity: b.intensity,
      luminanceThreshold: b.threshold,
      luminanceSmoothing: b.smoothing,
      mipmapBlur: true,
      radius: b.radius,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const vignette = new VignetteEffect({ offset: config.post.vignetteOffset, darkness: config.post.vignetteDarkness });
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    grain.blendMode.opacity.value = config.post.grain;
    this.composer.addPass(new EffectPass(this.camera, this.bloom, tone, vignette));
    this.composer.addPass(new EffectPass(this.camera, grain));

    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) this.onScreen = e.isIntersecting;
      },
      { rootMargin: '10% 0px' },
    ).observe(canvas);
    this.resize();
    stages.add(this);
    startTicker();
  }

  onFrame(fn: FrameFn): void {
    this.frameFns.push(fn);
  }

  onResize(fn: (w: number, h: number) => void): void {
    this.resizeFns.push(fn);
    fn(this.width, this.height);
  }

  get aspect(): number {
    return this.width / this.height;
  }

  resize(): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(cappedDpr());
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.renderer.getDrawingBufferSize(this.bufferSize);
    this.lit.uRes.value.copy(this.bufferSize);
    const s = config.render.lightScale;
    this.lightTarget.setSize(Math.max(4, Math.round(this.bufferSize.x * s)), Math.max(4, Math.round(this.bufferSize.y * s)));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this.resizeFns) fn(w, h);
    // Resizing clears the canvas; draw straight away so it never flashes black.
    this.render();
  }

  frame(dt: number, time: number): void {
    for (const fn of this.frameFns) fn(dt, time);
    this.render(dt);
  }

  /** Draw now (also used by the share card, which reads the canvas right after). */
  render(dt = 0): void {
    const r = this.renderer;
    r.setRenderTarget(this.lightTarget);
    r.setClearColor(0x000000, 1);
    r.clear(true, false, false);
    r.render(this.lightScene, this.camera);
    r.setRenderTarget(null);
    r.setClearColor(this.clearColor, 1);
    this.bloom.intensity = config.bloom.intensity + this.bloomBoost;
    this.composer.render(dt);
  }

  /** CSS pixel position of a world point (for hit tests). */
  toScreen(p: Vector3, out = new Vector2()): Vector2 {
    const v = tmp.copy(p).project(this.camera);
    return out.set((v.x * 0.5 + 0.5) * this.width, (0.5 - v.y * 0.5) * this.height);
  }

  /** World point under a CSS pixel, on the plane z = `z` (camera looking roughly down -z). */
  fromScreen(x: number, y: number, z: number, out = new Vector3()): Vector3 {
    const ndc = tmp.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2, 0.5).unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    const t = (z - this.camera.position.z) / dir.z;
    return out.copy(this.camera.position).addScaledVector(dir, t);
  }

  /** World point under a CSS pixel at a fixed distance in front of the camera. */
  atDistance(x: number, y: number, dist: number, out = new Vector3()): Vector3 {
    const ndc = tmp.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2, 0.5).unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    return out.copy(this.camera.position).addScaledVector(dir, dist);
  }
}

const tmp = new Vector3();
