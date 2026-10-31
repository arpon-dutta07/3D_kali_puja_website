import { gsap } from 'gsap';
import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3, Vector4, type Texture } from 'three';
import { config } from '../config';
import { sfx, soundButton, soundFireworks } from '../audio/sfx';
import { CameraRig } from '../gl/camera';
import { Fireworks, SHELLS, imagePoints, textPoints, type FormPoint } from '../gl/fireworks';
import { LampField } from '../gl/lamps';
import { litMaterial, lu } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf, assetUrl, loadTexture } from '../lib/assets';
import { bn, buzz, clamp, damp, isTouch } from '../lib/device';
import { journal } from '../lib/journal';
import type { Chapter } from '../journey';
import { cornerButton, counter, Overlay } from '../ui/overlay';
import { grab, keepMoment, moment, StoryShare, storyCard, storyCta } from '../ui/story';

/** The finale's words burn amber, a shade deeper than the shells' gold so bloom does not wash them white. */
const AMBER = new Color('#ff9d3a');

/** Ma's face in intro/ma.webp (u from the left, v from the top), for the vision in the sky. */
const FACE = { u0: 0.36, v0: 0.04, u1: 0.64, v1: 0.33 };

/** The vision: Ma's face from the murti, glowing, with soft edges that melt into the night. */
function visionMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: map },
      uCrop: { value: new Vector4(FACE.u0, FACE.v0, FACE.u1, FACE.v1) },
      uOpacity: { value: 0 },
      uGain: { value: 1.45 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec4 uCrop; uniform float uOpacity; uniform float uGain;
      varying vec2 vUv;
      void main() {
        vec2 uv = vec2(mix(uCrop.x, uCrop.z, vUv.x), mix(1.0 - uCrop.w, 1.0 - uCrop.y, vUv.y));
        vec4 c = texture2D(map, uv);
        vec2 q = (vUv - 0.5) * 2.0;
        float mask = (1.0 - smoothstep(0.6, 1.0, length(q * vec2(1.0, 0.92)))) * smoothstep(0.0, 0.3, vUv.y);
        gl_FragColor = vec4(c.rgb * uGain, c.a * mask * uOpacity);
      }`,
  });
}

type Step = 'idle' | 'lamps' | 'finale' | 'done';

/**
 * ছাদের দীপাবলি: an old North Kolkata rooftop at dusk. Fourteen prodips stand on the parapet, the চোদ্দ প্রদীপ for the
 * চোদ্দ পুরুষ; sweep along the ledge to light them. Then night falls, the fireworks write শুভ দীপাবলি across the sky,
 * and Ma's face blooms out of the sparks.
 */
export class Chhad implements Chapter {
  readonly stage: Stage;
  readonly overlay: Overlay;
  done = false;
  onDone: (() => void) | null = null;
  private rig: CameraRig;
  private step: Step = 'idle';
  private D = 10;
  private view = { w: 1, h: 1 };
  /** One full rooftop photo (round 2), or the older city + cut-out wall. */
  private full = false;
  private ledgeFrac = 0.655;
  private bg!: Mesh;
  private bgMat!: ShaderMaterial;
  private parapet: Mesh | null = null;
  private wallFrac = 0.35;
  private ledgeY = 0;
  private lamps!: LampField;
  private bowlAspect = 1;
  private carry!: LampField;
  private carryAmp = 0;
  private fw!: Fireworks;
  private words: FormPoint[] = [];
  private face: FormPoint[] = [];
  private vision: Mesh | null = null;
  private ambientTimer = 0;
  private pointer = { x: 0, y: 0, px: 0, py: 0, active: false };
  private counterEl: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private tmp = new Vector3();

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 45, background: '#05060f' });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.15;
    this.overlay = new Overlay(section);
    this.counterEl = counter(this.overlay.root);
    this.skipBtn = cornerButton(this.overlay.root, config.copy.ui.skip, () => this.skip());
    this.skipBtn.hidden = true;
    soundButton(this.overlay.root);
  }

  async init(): Promise<void> {
    const S = this.stage;
    const portrait = S.aspect < 1;
    const [roof, roofTall, bowlArt] = await Promise.all([
      loadTexture('chhad/rooftop.webp'),
      loadTexture('chhad/rooftop-tall.webp'),
      artOr('common/prodip.webp', ph.prodipBowl),
    ]);

    let pic: Texture | null = null;
    if (portrait && roofTall) {
      pic = roofTall;
      this.ledgeFrac = config.chhad.ledgeTall;
    } else if (roof) {
      pic = roof;
      this.ledgeFrac = config.chhad.ledgeWide;
    }

    if (pic) {
      // Wall and city in one photo, so they always match.
      this.full = true;
      this.bgMat = litMaterial(S, pic, { ambient: 0.62, gain: 0.9, transparent: false });
      this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(pic)), this.bgMat);
      S.scene.add(this.bg);
    } else {
      const [cityArt, parapetArt] = await Promise.all([
        artOr('chhad/city.webp', () => ph.city(false)),
        artOr('chhad/parapet.webp', ph.parapet),
      ]);
      this.bgMat = litMaterial(S, cityArt.tex, { ambient: 0.9, gain: 0, transparent: false });
      this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(cityArt.tex)), this.bgMat);
      this.bg.position.z = -14;
      S.scene.add(this.bg);
      this.wallFrac = parapetArt.real ? 1 - 0.393 : 0.35;
      this.parapet = new Mesh(new PlaneGeometry(1, 1 / aspectOf(parapetArt.tex)), litMaterial(S, parapetArt.tex, { ambient: 0.16, gain: 1.25 }));
      this.parapet.renderOrder = 6;
      S.scene.add(this.parapet);
    }

    // The fourteen prodips.
    this.bowlAspect = aspectOf(bowlArt.tex);
    const flame = bowlArt.real ? config.flames.prodip : config.flames.prodipPlaceholder;
    this.lamps = new LampField(S, Array.from({ length: config.chhad.lamps }, () => new Vector3()), 1, {
      bowl: bowlArt.tex,
      bowlAspect: this.bowlAspect,
      ...flame,
      light: 7,
      lightAmp: 0.5,
      ambient: 0.12,
    });
    this.lamps.onIgnite = () => this.onLamp();
    this.carry = new LampField(S, [new Vector3()], 1, { bowl: null, light: 6, lightAmp: 0.5 });
    this.carry.setAll(true, true);
    this.carry.master = 0;

    const ma = await loadTexture('intro/ma.webp');
    if (ma) {
      const fa = ((FACE.u1 - FACE.u0) * aspectOf(ma)) / (FACE.v1 - FACE.v0);
      this.vision = new Mesh(new PlaneGeometry(fa, 1), visionMaterial(ma));
      this.vision.renderOrder = 4;
      S.scene.add(this.vision);
    }

    this.fw = new Fireworks(S, 9000);
    this.fw.z = this.full ? 0.05 : -1;
    soundFireworks(this.fw, (x) => x / (this.view.w / 2));

    S.onResize(() => this.layout());
    S.onFrame((dt) => this.update(dt));
    this.bindInput();
  }

  private layout(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    this.view.h = 2 * this.D * tan;
    this.view.w = this.view.h * S.aspect;
    const { w, h } = this.view;
    this.rig.snap({ pos: new Vector3(0, 0, this.D), target: new Vector3(0, 0, 0) });
    const aspect = (m: Mesh) => 1 / (m.geometry as PlaneGeometry).parameters.height;

    if (this.full) {
      // The photo covers the screen (a little extra for the parallax); the ledge is measured on it.
      const a = aspect(this.bg);
      const pw = Math.max(w * 1.06, h * 1.06 * a);
      const ph_ = pw / a;
      this.bg.scale.set(pw, pw, 1);
      this.ledgeY = ph_ / 2 - ph_ * this.ledgeFrac;
    } else if (this.parapet) {
      const cd = this.D + 14;
      const ch = 2 * cd * tan * 1.12;
      this.bg.scale.setScalar(Math.max(ch * S.aspect, ch * aspect(this.bg)));
      const pa = aspect(this.parapet);
      const ph_ = Math.max((w * 1.06) / pa, (h * 0.3) / this.wallFrac);
      this.parapet.scale.set(ph_ * pa, ph_ * pa, 1);
      this.parapet.position.set(0, -h / 2 + ph_ / 2, 0);
      this.ledgeY = -h / 2 + ph_ * this.wallFrac;
    }

    // Fourteen prodips spread along the visible ledge; on a phone they sit almost shoulder to shoulder.
    const n = this.lamps.count;
    const span = w * (S.aspect < 1 ? 0.94 : 0.8);
    const gap = span / n;
    const size = clamp(gap * (S.aspect < 1 ? 0.9 : 0.62), 0.18, 0.5);
    for (let i = 0; i < n; i++) {
      this.lamps.setSize(i, size);
      this.lamps.setPosition(i, this.tmp.set(-span / 2 + gap * (i + 0.5), this.ledgeY + (size / this.bowlAspect) * 0.42, 0.1));
    }
    this.carry.setSize(0, size * 1.1);

    // Fireworks: one burst unit scales with the sky above the wall.
    this.fw.u = Math.min(h, w * 1.4) / 8.3;
    this.fw.groundY = this.ledgeY;
    void this.prepareForms();
  }

  /** The words and the face the finale draws in sparks, sized to this screen. */
  private async prepareForms(): Promise<void> {
    const { w, h } = this.view;
    const sky = h / 2 - this.ledgeY;
    this.words = await textPoints(config.copy.chhad.finale, Math.min(w * 0.86, sky * 2.4), AMBER, this.stage.aspect < 1 ? 5 : 6);
    try {
      this.face = await imagePoints(assetUrl('intro/ma.webp'), FACE, this.faceHeight(), 1500);
      this.vision?.scale.setScalar(this.faceHeight());
    } catch {
      this.face = [];
    }
  }

  /** Ma's face fills most of the sky; on a phone a little less, so the crown keeps clear of the top edge. */
  private faceHeight(): number {
    return (this.view.h / 2 - this.ledgeY) * (this.stage.aspect < 1 ? 0.6 : 0.74);
  }

  engage(): void {
    if (this.step !== 'idle') return;
    this.step = 'lamps';
    this.skipBtn.hidden = false;
    const c = config.copy.chhad.lamps;
    this.overlay.say('step', isTouch() ? { bn: c.bn } : c, 'top');
    this.counterEl.textContent = `${bn(this.lamps.litCount)} / ${bn(this.lamps.count)}`;
    this.counterEl.classList.add('on');
    this.stage.canvas.classList.add('carry');
  }

  skip(): void {
    if (this.step !== 'lamps') return;
    for (let i = 0; i < this.lamps.count; i++) this.lamps.ignite(i, i * 0.07);
  }

  private bindInput(): void {
    const el = this.section;
    const pos = (e: PointerEvent) => {
      const r = this.stage.canvas.getBoundingClientRect();
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
    };
    el.addEventListener('pointerdown', (e) => {
      if (this.step !== 'lamps') return;
      pos(e);
      this.pointer.px = this.pointer.x;
      this.pointer.py = this.pointer.y;
      this.pointer.active = true;
      this.sweep();
    });
    el.addEventListener('pointermove', (e) => {
      if (this.step !== 'lamps') return;
      pos(e);
      if (e.pointerType === 'mouse') this.pointer.active = true;
      if (this.pointer.active) this.sweep();
    });
    // Sideways sweeps light the ledge; vertical swipes scroll the page.
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') this.pointer.active = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.pointer.active = false;
    });
  }

  /** Light every prodip near the segment the pointer just travelled (a tap lights the one under it). */
  private sweep(): void {
    const r = Math.max(24, ((this.stage.width * 0.8) / this.lamps.count) * 0.62);
    const { px: x0, py: y0, x: x1, y: y1 } = this.pointer;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    for (let i = 0; i < this.lamps.count; i++) {
      if (this.lamps.isLit(i)) continue;
      const s = this.stage.toScreen(this.lamps.flamePoint(i, this.tmp));
      const t = len2 > 0 ? clamp(((s.x - x0) * dx + (s.y - y0) * dy) / len2, 0, 1) : 0;
      if (Math.hypot(x0 + dx * t - s.x, y0 + dy * t - s.y) < r * 1.3) this.lamps.ignite(i, t * 0.06);
    }
  }

  private onLamp(): void {
    buzz(8);
    const lit = this.lamps.litCount;
    this.overlay.hide('step');
    this.counterEl.textContent = `${bn(lit)} / ${bn(this.lamps.count)}`;
    if (this.step === 'lamps' && lit >= this.lamps.count) {
      this.step = 'finale';
      gsap.delayedCall(1.1, () => this.finale());
    }
  }

  /** Night falls; a few shells; then the sky writes শুভ দীপাবলি and Ma's face blooms out of the sparks. */
  private finale(): void {
    journal.roof(this.lamps.count);
    this.skipBtn.hidden = true;
    this.counterEl.classList.remove('on');
    this.stage.canvas.classList.remove('carry');
    this.pointer.active = false;
    sfx.unlock();
    const { w } = this.view;
    const sky = this.view.h / 2 - this.ledgeY;
    const cy = this.ledgeY + sky * 0.55;
    const tl = gsap.timeline();
    const night = this.full ? { r: 0.34, g: 0.36, b: 0.46 } : { r: 0.55, g: 0.55, b: 0.62 };
    tl.to(lu(this.bgMat).uAmbient.value, { ...night, duration: 3, ease: 'power1.inOut' }, 0);
    tl.to(this.stage, { bloomBoost: 0.3, duration: 2 }, 0.5);
    // An opening volley.
    const opening: Array<[number, number]> = [[-0.28, 0.3], [0.3, 0.7], [-0.05, 1.1], [0.18, 1.6], [-0.36, 1.9]];
    for (const [x, at] of opening) {
      tl.call(() => this.fw.launch(x * w, x * w * 0.9, cy + (Math.random() - 0.3) * sky * 0.3, SHELLS[Math.floor(Math.random() * SHELLS.length)]), [], at);
    }
    // শুভ দীপাবলি in sparks.
    tl.call(() => this.fw.launchForm(0, 0, cy + sky * 0.05, this.words, 1.05), [], 3.2);
    tl.call(() => {
      buzz([30, 60, 30]);
      this.fw.launch(-0.4 * w, -0.42 * w, cy + sky * 0.25, 'willow');
      this.fw.launch(0.4 * w, 0.42 * w, cy + sky * 0.25, 'willow');
    }, [], 5.2);
    // Ma's face.
    if (this.face.length) {
      const fy = cy + sky * (this.stage.aspect < 1 ? 0.01 : 0.05);
      tl.call(() => this.fw.launchForm(0, 0, fy, this.face, 1.2), [], 9.2);
      // As the sparks gather, her face glows in behind them, holds, and goes back to the dark with the falling glitter.
      if (this.vision) {
        const v = this.vision;
        v.position.set(0, fy, 0.02);
        const op = (v.material as ShaderMaterial).uniforms.uOpacity!;
        tl.to(op, { value: 0.95, duration: 1.8, ease: 'power2.out' }, 10.7);
        tl.to(this.stage, { bloomBoost: 0.55, duration: 1.5 }, 10.7);
        tl.to(op, { value: 0, duration: 1.8, ease: 'power2.in' }, 14.6);
        tl.to(this.stage, { bloomBoost: 0.3, duration: 1.5 }, 14.6);
      }
    }
    tl.call(() => {
      for (const [x, k] of [[-0.38, 'ring'], [0.38, 'ring']] as const) this.fw.launch(x * w, x * w, cy + sky * 0.18, k);
    }, [], 11.6);
    // Ma's face at its brightest is kept for the story card.
    if (this.face.length) tl.call(() => keepMoment('face', this.stage), [], 12.8);
    tl.call(() => {
      this.step = 'done';
      this.done = true;
      this.onDone?.();
      this.offerStory();
    }, [], this.face.length ? 16.4 : 9);
  }

  /** After the finale: put this night in your story (and tag the page). */
  private offerStory(): void {
    const share = new StoryShare(() => storyCard(moment('face') ?? grab(this.stage)));
    share.prepare();
    const cta = storyCta(this.overlay.root, share);
    requestAnimationFrame(() => requestAnimationFrame(() => cta.classList.add('on')));
    setTimeout(() => cta.classList.add('on'), 80);
  }

  private update(dt: number): void {
    const S = this.stage;
    // The flame you carry along the ledge.
    const carrying = this.step === 'lamps' && this.pointer.active;
    this.carryAmp += ((carrying ? 1 : 0) - this.carryAmp) * damp(0.08, dt);
    this.carry.master = this.carryAmp;
    if (carrying) this.carry.setPosition(0, S.fromScreen(this.pointer.x, this.pointer.y, 0.2, this.tmp));

    // After the finale, a shell now and then while the rooftop is on screen.
    if (this.step === 'done') {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 1.6 + Math.random() * 2.4;
        const { w } = this.view;
        const sky = this.view.h / 2 - this.ledgeY;
        const x = (Math.random() - 0.5) * w * 0.8;
        this.fw.launch(x, x * 0.9, this.ledgeY + sky * (0.4 + Math.random() * 0.4));
      }
    }
  }
}
