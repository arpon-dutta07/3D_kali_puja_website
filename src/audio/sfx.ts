import type { Fireworks } from '../gl/fireworks';
import { assetUrl } from '../lib/assets';

/**
 * Sound effects: recorded fireworks (booms, crackle, fizz, whistles) and the ghost house (fan, power cut, tube light,
 * whispers, crickets); sources in public/assets/audio/CREDITS.md. Web Audio, unlocked on the visitor's first tap. Each
 * boom gets a little random pitch and is panned to where it burst, and arrives a moment after the flash, the way it does
 * in a real sky. The section music (src/audio/music.ts) plays through the same output, so one mute covers everything.
 */
const FILES = [
  'boom-1', 'boom-2', 'boom-3', 'boom-4', 'boom-5', 'boom-6', 'crackle-1', 'crackle-2', 'fizz', 'launch', 'whistle-1', 'whistle-2', 'whistle-3',
  'fan', 'fan-down', 'fan-up', 'powercut', 'tube', 'creepy', 'crickets', 'whisper-1', 'whisper-2', 'breath', 'howl',
];
const KEY = 'kali:sound';

export interface LoopHandle {
  stop(fade?: number): void;
  /** Move the level to `v` over about `seconds`. */
  gain(v: number, seconds?: number): void;
  /** Change speed (and pitch) over about `seconds`. */
  rate(v: number, seconds?: number): void;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private listeners = new Set<(on: boolean) => void>();
  private _on = true;

  constructor() {
    try {
      this._on = localStorage.getItem(KEY) !== 'off';
    } catch {
      /* Private mode: sound stays on. */
    }
    // Browsers only allow sound after a tap; any tap anywhere on the page unlocks it. (On phones only the end of a touch
    // counts as one, hence pointerup and click as well.)
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
    // Nothing plays in a background tab.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  /** The context and the master bus, once unlocked (the music plays through them). */
  output(): { ctx: AudioContext; master: GainNode } | null {
    return this.ctx && this.master ? { ctx: this.ctx, master: this.master } : null;
  }

  get on(): boolean {
    return this._on;
  }

  set on(v: boolean) {
    this._on = v;
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05);
    for (const fn of this.listeners) fn(v);
  }

  onChange(fn: (on: boolean) => void): void {
    this.listeners.add(fn);
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // A gentle compressor so a volley of booms never clips.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      this.master = this.ctx.createGain();
      this.master.gain.value = this._on ? 0.8 : 0;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
    this.loading ??= this.load();
  }

  private async load(): Promise<void> {
    const ctx = this.ctx!;
    await Promise.all(
      FILES.map(async (name) => {
        try {
          const res = await fetch(assetUrl(`audio/${name}.mp3`));
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(name, buf);
        } catch {
          /* A missing sound is just silence. */
        }
      }),
    );
  }

  /** Play one of `names` (picked at random). pan -1..1, delay in seconds. */
  play(names: string | string[], o: { gain?: number; pan?: number; rate?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.master || !this._on) return;
    const list = Array.isArray(names) ? names : [names];
    const buf = this.buffers.get(list[Math.floor(Math.random() * list.length)]!);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = o.gain ?? 1;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    src.connect(g).connect(p).connect(this.master);
    src.start(this.ctx.currentTime + (o.delay ?? 0));
  }

  /**
   * A looping sound (a tubri's fizz, the ghost house's fan and crickets). It exists even while muted, so un-muting brings
   * it back, and if its file is still loading it starts as soon as it arrives.
   */
  loop(name: string, o: { gain?: number; pan?: number; rate?: number; fade?: number } = {}): LoopHandle | null {
    if (!this.ctx || !this.master) return null;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    g.connect(p).connect(this.master);
    let src: AudioBufferSourceNode | null = null;
    let stopped = false;
    let rate = o.rate ?? 1;
    let level = o.gain ?? 0.6;
    const begin = () => {
      const buf = this.buffers.get(name);
      if (!buf || stopped || src) return;
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      src.connect(g);
      src.start();
      g.gain.setTargetAtTime(level, ctx.currentTime, Math.max(0.02, (o.fade ?? 0.25) / 3));
    };
    if (this.buffers.has(name)) begin();
    else void this.loading?.then(begin);
    return {
      stop: (fade = 0.4) => {
        stopped = true;
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
        src?.stop(ctx.currentTime + fade + 0.1);
      },
      gain: (v: number, seconds = 0.15) => {
        level = v;
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.01, seconds / 3));
      },
      rate: (v: number, seconds = 0.5) => {
        rate = v;
        src?.playbackRate.setTargetAtTime(v, ctx.currentTime, Math.max(0.01, seconds / 3));
      },
    };
  }
}

export const sfx = new Sfx();

const BOOMS = ['boom-1', 'boom-2', 'boom-3', 'boom-4', 'boom-5', 'boom-6'];

/** Wire a fireworks display to the sounds: launch whoosh, boom (late, panned), crackle. `screenX` maps world x to -1..1. */
export function soundFireworks(
  fw: Fireworks,
  pan: (x: number) => number,
  volume = 1,
): void {
  fw.onLaunch = (x) => sfx.play('launch', { gain: 0.45 * volume, pan: pan(x) * 0.6, rate: 0.85 + Math.random() * 0.3 });
  fw.onBurst = (shell, x, big) => {
    const delay = 0.12 + Math.random() * 0.18;
    sfx.play(BOOMS, { gain: (big ? 1 : 0.8) * volume, pan: pan(x) * 0.7, rate: 0.85 + Math.random() * 0.3, delay });
    if (shell === 'crackle' || shell === 'strobe' || shell === 'willow') {
      sfx.play(['crackle-1', 'crackle-2'], { gain: 0.7 * volume, pan: pan(x) * 0.7, delay: delay + 0.6 + Math.random() * 0.3 });
    }
  };
  fw.onCrackle = (x) => sfx.play(['crackle-1', 'crackle-2'], { gain: 0.35 * volume, pan: pan(x) * 0.7, rate: 0.9 + Math.random() * 0.3 });
  // হাউই: the whistle as it climbs, then a small, higher bang.
  fw.onWhistle = (x) => sfx.play(['whistle-1', 'whistle-2', 'whistle-3'], { gain: 0.85 * volume, pan: pan(x) * 0.6, rate: 0.92 + Math.random() * 0.16 });
  fw.onPop = (x) => {
    sfx.play(BOOMS, { gain: 0.38 * volume, pan: pan(x) * 0.7, rate: 1.55 + Math.random() * 0.3, delay: 0.05 });
    sfx.play(['crackle-1', 'crackle-2'], { gain: 0.45 * volume, pan: pan(x) * 0.7, delay: 0.25 });
  };
}

/** A small round sound on/off button for the fireworks scenes. */
export function soundButton(parent: HTMLElement): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sound-btn';
  const paint = (on: boolean) => {
    b.setAttribute('aria-label', on ? 'Sound off' : 'Sound on');
    b.innerHTML = on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6" fill="none"/></svg>';
  };
  paint(sfx.on);
  sfx.onChange(paint);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.unlock();
    sfx.on = !sfx.on;
  });
  parent.appendChild(b);
  return b;
}
