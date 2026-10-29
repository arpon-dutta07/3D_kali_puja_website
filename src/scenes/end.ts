import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { soundButton, soundFireworks, sfx } from '../audio/sfx';
import { CameraRig } from '../gl/camera';
import { Fireworks, SHELLS, randomColor, type Shell } from '../gl/fireworks';
import { litMaterial } from '../gl/lit';
import * as ph from '../gl/placeholders';
import { Stage } from '../gl/stage';
import { artOr, aspectOf } from '../lib/assets';

/** Where the roofs start and where the photo should be centred on a phone, measured on chhad/city.webp. */
const HORIZON_V = 0.56;
const PORTRAIT_U = 0.66;

/** The shells the closing show picks from; strobe and crackle stay rare so the sky reads calm behind the words. */
const SHOW: Shell[] = ['peony', 'chrysanthemum', 'willow', 'palm', 'ring', 'crossette', 'double', 'peony', 'chrysanthemum', 'willow'];

/**
 * The last screen: Kolkata at night, the bridge on the river, and a slow show of shells over the roofs. The greeting
 * sits low like a poster's title, so the sky above it is all fireworks. Tap the sky for one more.
 */
export class EndScene {
  readonly stage: Stage;
  private rig: CameraRig;
  private D = 10;
  private view = { w: 1, h: 1 };
  private bg: Mesh | null = null;
  private fw!: Fireworks;
  private horizonY = 0;
  private timer = 0.4;
  private live = false;
  private turn = 0;

  constructor(readonly section: HTMLElement) {
    const canvas = section.querySelector('canvas')!;
    this.stage = new Stage(canvas, { fov: 45, background: '#05060f' });
    this.rig = new CameraRig(this.stage);
    this.rig.sway = 0.08;
    soundButton(section);
    // The show runs while the screen is mostly in view.
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          this.live = e.isIntersecting;
          if (this.live) section.classList.add('on');
        }
      },
      { threshold: 0.55 },
    ).observe(section);
  }

  async init(): Promise<void> {
    const S = this.stage;
    const city = await artOr('chhad/city.webp', () => ph.city(false));
    // Night over the city: the photo pulled down to deep blue, so every burst lights the roofs and the bridge.
    const mat = litMaterial(S, city.tex, { ambient: '#5a6390', gain: 1.0, transparent: false });
    this.bg = new Mesh(new PlaneGeometry(1, 1 / aspectOf(city.tex)), mat);
    S.scene.add(this.bg);

    this.fw = new Fireworks(S, 9000);
    this.fw.z = 0.05;
    soundFireworks(this.fw, (x) => x / (this.view.w / 2), 0.7);

    S.onResize(() => this.layout());
    S.onFrame((dt) => this.update(dt));
    S.canvas.addEventListener('pointerdown', (e) => {
      const r = S.canvas.getBoundingClientRect();
      const p = S.fromScreen(e.clientX - r.left, e.clientY - r.top, 0);
      if (p.y < this.horizonY) return;
      sfx.unlock();
      this.fw.launch(p.x, p.x, p.y, SHELLS[Math.floor(Math.random() * SHELLS.length)]!, [randomColor(), randomColor()]);
    });
  }

  private layout(): void {
    const S = this.stage;
    const tan = Math.tan((S.camera.fov * Math.PI) / 360);
    this.view.h = 2 * this.D * tan;
    this.view.w = this.view.h * S.aspect;
    const { w, h } = this.view;
    this.rig.snap({ pos: new Vector3(0, 0, this.D), target: new Vector3(0, 0, 0) });
    if (!this.bg) return;
    const a = 1 / (this.bg.geometry as PlaneGeometry).parameters.height;
    const pw = Math.max(w * 1.06, h * 1.06 * a);
    const ph_ = pw / a;
    this.bg.scale.set(pw, pw, 1);
    // On a tall screen only a slice of the photo shows: slide it so the temple and the bridge are both in.
    const spare = (pw - w) / 2;
    this.bg.position.x = S.aspect < 1 ? clampAbs((0.5 - PORTRAIT_U) * pw, spare) : 0;
    // Keep the sky on top: pin the photo's top edge to the screen's top edge.
    this.bg.position.y = h / 2 - ph_ / 2 + (ph_ - h) * 0.15;
    this.horizonY = this.bg.position.y + ph_ / 2 - ph_ * HORIZON_V;
    this.fw.u = Math.min(h, w * 1.4) / 9;
    this.fw.groundY = this.horizonY;
  }

  private update(dt: number): void {
    if (!this.live) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const { w, h } = this.view;
    const sky = h / 2 - this.horizonY;
    // Mostly singles, now and then a pair from both sides, keeping the middle a little quieter for the words.
    const pair = this.turn % 4 === 3;
    this.timer = pair ? 2.2 : 0.8 + Math.random() * 1.1;
    const side = this.turn % 2 === 0 ? -1 : 1;
    this.turn++;
    const fire = (sgn: number) => {
      const x = sgn * (0.12 + Math.random() * 0.3) * w;
      const y = this.horizonY + sky * (0.45 + Math.random() * 0.4);
      this.fw.launch(x, x * 0.92, y, SHOW[Math.floor(Math.random() * SHOW.length)]!);
    };
    fire(side);
    if (pair) fire(-side);
  }
}

function clampAbs(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}
