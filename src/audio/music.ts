import { assetUrl } from '../lib/assets';
import { sfx } from './sfx';

/**
 * Each section's music: public/assets/music/<section>.mp3 (sources in CREDITS.md there). Replace a file and keep its
 * name, and that section plays the new one; no code changes. The ghost house has no music, it has its own sounds.
 */
const TRACKS = ['intro', 'mala', 'chhad', 'baji', 'end'] as const;
type Track = (typeof TRACKS)[number];

/** How loud each sits; lower where fireworks have to come through on top. */
const LEVEL: Record<Track, number> = { intro: 0.8, mala: 0.8, chhad: 0.62, baji: 0.42, end: 0.5 };

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  track: Track | null;
  pauseTimer: number;
}

/**
 * Two decks that cross-fade as you scroll from one section to the next. Nothing plays until the first tap (প্রদীপ জ্বালাও);
 * both decks are started inside that tap, which is what phones need to let them play later. A section you come back to
 * picks up where it left off.
 */
class Music {
  private decks: Deck[] = [];
  private live: Deck | null = null;
  private want: string | null = null;
  private started = false;
  private pos = new Map<Track, number>();

  constructor() {
    const go = () => this.start();
    for (const ev of ['pointerup', 'click', 'keydown']) window.addEventListener(ev, go, { passive: true });
  }

  /** The section now on screen (its id). */
  section(id: string | null): void {
    this.want = id;
    if (this.started) this.switch();
  }

  private start(): void {
    if (this.started) return;
    sfx.unlock();
    const out = sfx.output();
    if (!out) return;
    this.started = true;
    for (let i = 0; i < 2; i++) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      const gain = out.ctx.createGain();
      gain.gain.value = 0;
      out.ctx.createMediaElementSource(el).connect(gain).connect(out.master);
      this.decks.push({ el, gain, track: null, pauseTimer: 0 });
    }
    // Both decks play once inside this tap (silently); after that they may start on their own.
    const first = this.trackFor(this.want) ?? 'intro';
    for (const d of this.decks) {
      d.el.src = assetUrl(`music/${first}.mp3`);
      d.track = first;
      void d.el.play().then(
        () => {
          if (d !== this.live) d.el.pause();
        },
        () => {},
      );
    }
    this.switch();
  }

  private trackFor(id: string | null): Track | null {
    return (TRACKS as readonly string[]).includes(id ?? '') ? (id as Track) : null;
  }

  private switch(): void {
    const out = sfx.output();
    if (!out) return;
    const t = out.ctx.currentTime;
    const next = this.trackFor(this.want);
    if (this.live && this.live.track === next) return;

    // Let the current one go.
    const old = this.live;
    if (old) {
      if (old.track) this.pos.set(old.track, old.el.currentTime);
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setTargetAtTime(0, t, 0.45);
      window.clearTimeout(old.pauseTimer);
      old.pauseTimer = window.setTimeout(() => {
        if (old !== this.live) old.el.pause();
      }, 2200);
    }
    this.live = null;
    if (!next) return;

    // Bring the next one in on the other deck, from where it was left.
    const deck = this.decks.find((d) => d !== old) ?? this.decks[0]!;
    window.clearTimeout(deck.pauseTimer);
    const resume = this.pos.get(next) ?? 0;
    if (deck.track !== next) {
      deck.el.src = assetUrl(`music/${next}.mp3`);
      deck.track = next;
      if (resume > 0) deck.el.addEventListener('loadedmetadata', () => (deck.el.currentTime = resume), { once: true });
    } else if (resume > 0) {
      deck.el.currentTime = resume;
    }
    void deck.el.play().catch(() => {});
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setTargetAtTime(LEVEL[next], t + 0.3, 0.55);
    this.live = deck;
  }
}

export const music = new Music();
