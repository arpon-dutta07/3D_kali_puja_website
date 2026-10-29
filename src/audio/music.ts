import { config } from '../config';
import { sfx } from './sfx';

/**
 * Each section's song, streamed from YouTube (the video ids are in config.music). Two hidden YouTube players act as
 * decks and cross-fade as you scroll from one section to the next; only the sound is heard. Nothing plays until the
 * first tap (প্রদীপ জ্বালাও), and both players are started inside that tap, which phones need before they will play
 * later on their own. A section you come back to picks up where it left off. The ghost house has no song.
 */
type Track = keyof typeof config.music;

/** How loud each sits (YouTube volume, 0 to 100); lower where the fireworks have to come through on top. */
const LEVEL: Record<Track, number> = { intro: 85, mala: 85, chhad: 70, baji: 45, end: 55 };

/** The bits of the YouTube IFrame API used here. */
interface YTPlayer {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  cueVideoById(o: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
}
interface YTNamespace {
  Player: new (el: HTMLElement, o: object) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const ENDED = 0;
const PLAYING = 1;

let api: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return api;
}

class Deck {
  player: YTPlayer | null = null;
  ready: Promise<void>;
  track: Track | null = null;
  /** Current and wanted volume (0 to 100), stepped by the fader. */
  vol = 0;
  target = 0;
  playing = false;
  /** Set while the deck is being started silently in the first tap, to be paused once it really plays. */
  unlocking = false;

  constructor(host: HTMLElement, private onEnded: (d: Deck) => void) {
    const el = document.createElement('div');
    host.appendChild(el);
    this.ready = loadApi().then(
      (YT) =>
        new Promise<void>((resolve) => {
          this.player = new YT.Player(el, {
            width: 200,
            height: 200,
            host: 'https://www.youtube-nocookie.com',
            playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3, origin: location.origin },
            events: {
              onReady: () => {
                this.player!.setVolume(0);
                if (!sfx.on) this.player!.mute();
                resolve();
              },
              onStateChange: (e: { data: number }) => {
                if (e.data === ENDED) this.onEnded(this);
                if (e.data === PLAYING && this.unlocking) {
                  this.unlocking = false;
                  this.player!.pauseVideo();
                  this.playing = false;
                }
              },
            },
          });
        }),
    );
  }

  load(track: Track, at: number): void {
    this.track = track;
    this.player?.loadVideoById({ videoId: config.music[track], startSeconds: at });
    this.playing = true;
  }

  play(): void {
    this.player?.playVideo();
    this.playing = true;
  }

  pause(): void {
    this.player?.pauseVideo();
    this.playing = false;
  }

  time(): number {
    try {
      return this.player?.getCurrentTime() ?? 0;
    } catch {
      return 0;
    }
  }
}

class Music {
  private decks: Deck[] = [];
  private live: Deck | null = null;
  private want: string | null = null;
  private started = false;
  private pos = new Map<Track, number>();

  constructor() {
    const host = document.createElement('div');
    host.className = 'yt-music';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    const ended = (d: Deck) => {
      // Loop: back to the start of the song.
      if (d === this.live) {
        d.player?.seekTo(0, true);
        d.play();
      }
    };
    this.decks = [new Deck(host, ended), new Deck(host, ended)];
    const go = () => this.start();
    for (const ev of ['pointerup', 'click', 'keydown']) window.addEventListener(ev, go, { passive: true });
    // One mute for everything, and nothing in a background tab.
    sfx.onChange((on) => {
      for (const d of this.decks) {
        if (on) d.player?.unMute();
        else d.player?.mute();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!this.live) return;
      if (document.hidden) this.live.pause();
      else this.live.play();
    });
    // The fader: volumes glide towards their targets; a deck that has faded out is paused.
    window.setInterval(() => this.fade(), 50);
  }

  /** The section now on screen (its id). */
  section(id: string | null): void {
    this.want = id;
    if (this.started) this.switch();
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    const first = this.trackFor(this.want);
    const [a, b] = this.decks as [Deck, Deck];
    const begin = () => {
      // Inside the tap: the first deck starts the section's song, the second plays silently for a moment so it is
      // allowed to start on its own later.
      if (first) {
        a.load(first, this.pos.get(first) ?? 0);
        this.live = a;
        a.target = LEVEL[first];
      }
      b.unlocking = true;
      b.load(first ?? 'intro', 0);
    };
    if (a.player && b.player) begin();
    else void Promise.all([a.ready, b.ready]).then(begin);
  }

  private trackFor(id: string | null): Track | null {
    return id && id in config.music ? (id as Track) : null;
  }

  private switch(): void {
    const next = this.trackFor(this.want);
    if (this.live && this.live.track === next) return;

    // Let the current one go (the fader pauses it once it is silent).
    const old = this.live;
    if (old) {
      if (old.track) this.pos.set(old.track, old.time());
      old.target = 0;
    }
    this.live = null;
    if (!next) return;

    // Bring the next one in on the other deck, from where it was left.
    const deck = this.decks.find((d) => d !== old) ?? this.decks[0]!;
    deck.unlocking = false;
    deck.vol = 0;
    deck.player?.setVolume(0);
    const at = this.pos.get(next) ?? 0;
    if (deck.track === next) {
      deck.player?.seekTo(at, true);
      deck.play();
    } else {
      deck.load(next, at);
    }
    deck.target = LEVEL[next];
    this.live = deck;
  }

  private fade(): void {
    for (const d of this.decks) {
      if (!d.player || d.vol === d.target) continue;
      // About a second and a half from silence to full.
      const step = 4;
      d.vol = d.vol < d.target ? Math.min(d.target, d.vol + step) : Math.max(d.target, d.vol - step);
      d.player.setVolume(d.vol);
      if (d.vol === 0 && d.target === 0 && d !== this.live && d.playing) d.pause();
    }
  }
}

export const music = new Music();
