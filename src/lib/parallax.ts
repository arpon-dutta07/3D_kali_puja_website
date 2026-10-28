import { createNoise2D } from 'simplex-noise';
import { config } from '../config';
import { clamp, damp, prefersReducedMotion, smoothstep } from './device';

/**
 * One shared "where is the viewer looking" input for every scene: phone tilt when there is a gyro, the mouse when it
 * moved recently, otherwise a slow drift. Smoothed so nothing ever jitters. x, y in -1..1.
 */
class Parallax {
  readonly value = { x: 0, y: 0 };
  private mouse = { x: 0, y: 0 };
  private lastMouse = -Infinity;
  private gyro: { beta: number; gamma: number } | null = null;
  private base: { beta: number; gamma: number } | null = null;
  private noise = createNoise2D();
  private time = 0;

  constructor() {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = 1 - (e.clientY / innerHeight) * 2;
      this.lastMouse = this.time;
    });
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      this.gyro = { beta: e.beta, gamma: e.gamma };
      this.base ??= { ...this.gyro };
    });
  }

  /** Call inside a tap: iOS only shows the motion prompt from a gesture. Also re-levels to how the phone is held. */
  requestMotion(): void {
    this.base = this.gyro ? { ...this.gyro } : null;
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent;
    DOE?.requestPermission?.().catch(() => {
      /* Denied: the drift takes over. */
    });
  }

  update(dt: number): void {
    this.time += dt;
    const p = config.parallax;
    let tx: number;
    let ty: number;
    if (this.gyro && this.base) {
      const portrait = (screen.orientation?.angle ?? 0) % 180 === 0;
      const dg = this.gyro.gamma - this.base.gamma;
      const db = this.gyro.beta - this.base.beta;
      const [gx, gy] = portrait ? [dg, db] : [db, -dg];
      tx = clamp(gx / p.gyroRangeDeg, -1, 1);
      ty = clamp(-gy / p.gyroRangeDeg, -1, 1);
    } else {
      const drift = {
        x: this.noise(this.time * p.driftHz, 0.5) * p.driftAmount,
        y: this.noise(17.3, this.time * p.driftHz) * p.driftAmount * 0.6,
      };
      const k = smoothstep(p.mouseIdleSeconds, p.mouseIdleSeconds + 3, this.time - this.lastMouse);
      tx = this.mouse.x + (drift.x - this.mouse.x) * k;
      ty = this.mouse.y + (drift.y - this.mouse.y) * k;
    }
    const scale = prefersReducedMotion() ? 0.3 : 1;
    const a = damp(p.halfLife, dt);
    this.value.x += (tx * scale - this.value.x) * a;
    this.value.y += (ty * scale - this.value.y) * a;
  }
}

export const parallax = new Parallax();
