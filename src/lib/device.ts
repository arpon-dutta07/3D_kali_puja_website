import { config } from '../config';

const params = new URLSearchParams(location.search);

/** Dev helpers (lamp position editor, frame stats) only load with `?debug` in the URL. */
export const isDebug = params.has('debug');

/** Touch-first device or a phone-sized screen. */
export function isPhone(): boolean {
  const shortSide = Math.min(screen.width, screen.height);
  return matchMedia('(pointer: coarse)').matches || shortSide < config.render.phoneMaxShortSide;
}

export function isTouch(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function cappedDpr(): number {
  const cap = isPhone() ? config.render.dprPhone : config.render.dprDesktop;
  return Math.min(window.devicePixelRatio || 1, cap);
}

/** A short buzz on Android. iPhones have no vibration API; the page never depends on it. */
export function buzz(pattern: number | number[]): void {
  // Chrome refuses (and logs an error) until the visitor has tapped the page at least once.
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (ua && !ua.hasBeenActive) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* Not allowed without a recent gesture: fine. */
  }
}

/** Bengali digits for the counters. */
export function bn(n: number): string {
  return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Exponential smoothing factor for a half-life in seconds, frame-rate independent. */
export function damp(halfLife: number, dt: number): number {
  return 1 - Math.pow(2, -dt / Math.max(1e-4, halfLife));
}
