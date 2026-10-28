import { gsap } from 'gsap';
import { PerspectiveCamera, Vector3 } from 'three';
import { config } from '../config';
import { prefersReducedMotion } from '../lib/device';
import { parallax } from '../lib/parallax';
import type { Stage } from './stage';

export interface Shot {
  pos: Vector3;
  target: Vector3;
}

const scratch = new PerspectiveCamera();
const v = new Vector3();

/**
 * Camera distance along `dir` (from `target`) at which every point fits inside the screen with the given margins
 * (fractions of half the screen). Works for any aspect ratio, so phones and desktops frame the same things.
 */
export function fitShot(
  stage: Stage,
  points: Vector3[],
  target: Vector3,
  dir: Vector3,
  margin: { x: number; y: number } = { x: 0.9, y: 0.86 },
): Shot {
  scratch.fov = stage.camera.fov;
  scratch.aspect = stage.aspect;
  scratch.near = 0.05;
  scratch.far = 500;
  scratch.updateProjectionMatrix();
  const d = dir.clone().normalize();
  let lo = 0.5;
  let hi = 200;
  for (let it = 0; it < 30; it++) {
    const mid = (lo + hi) / 2;
    scratch.position.copy(target).addScaledVector(d, mid);
    scratch.lookAt(target);
    scratch.updateMatrixWorld();
    let fits = true;
    for (const p of points) {
      v.copy(p).project(scratch);
      if (Math.abs(v.x) > margin.x || Math.abs(v.y) > margin.y || v.z > 1) {
        fits = false;
        break;
      }
    }
    if (fits) hi = mid;
    else lo = mid;
  }
  return { pos: target.clone().addScaledVector(d, hi), target: target.clone() };
}

/**
 * Holds the current framing, tweens between shots and adds the shared parallax on top.
 */
export class CameraRig {
  readonly pos = new Vector3(0, 0, 10);
  readonly target = new Vector3();
  /** World units of parallax nudge at full input. */
  sway = config.parallax.amount;
  private tween: gsap.core.Timeline | null = null;
  private right = new Vector3();
  private up = new Vector3();

  constructor(private stage: Stage) {
    stage.onFrame(() => this.apply());
  }

  snap(shot: Shot): void {
    this.tween?.kill();
    this.pos.copy(shot.pos);
    this.target.copy(shot.target);
    this.apply();
  }

  to(shot: Shot, duration: number, ease = 'power2.inOut'): gsap.core.Timeline {
    this.tween?.kill();
    const d = prefersReducedMotion() ? Math.min(duration, 0.4) : duration;
    const tl = gsap.timeline();
    tl.to(this.pos, { x: shot.pos.x, y: shot.pos.y, z: shot.pos.z, duration: d, ease }, 0);
    tl.to(this.target, { x: shot.target.x, y: shot.target.y, z: shot.target.z, duration: d, ease }, 0);
    this.tween = tl;
    return tl;
  }

  apply(): void {
    const cam = this.stage.camera;
    const fwd = v.copy(this.target).sub(this.pos).normalize();
    this.right.crossVectors(fwd, cam.up).normalize();
    this.up.crossVectors(this.right, fwd).normalize();
    const p = parallax.value;
    const dist = this.pos.distanceTo(this.target);
    const k = this.sway * Math.min(1.5, dist / 8);
    cam.position.copy(this.pos).addScaledVector(this.right, p.x * k).addScaledVector(this.up, p.y * k * 0.6);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
  }
}
