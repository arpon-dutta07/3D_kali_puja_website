import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { config } from './config';

/** A full-screen interactive chapter that the page stops on until it's finished (or skipped). */
export interface Chapter {
  readonly section: HTMLElement;
  done: boolean;
  init(): Promise<void>;
  engage(): void;
  skip(): void;
  onDone: (() => void) | null;
}

/**
 * The scroll journey after the opening: smooth scroll, and each chapter snaps into place and holds the page until its
 * moment is done. Scrolling back up never re-locks a finished chapter.
 */
export class Journey {
  readonly lenis: Lenis;
  private started = false;
  private active: Chapter | null = null;
  private pending: Chapter | null = null;

  constructor() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    this.lenis = new Lenis({ lerp: 0.09, smoothWheel: true, autoRaf: true, prevent: (node) => node.classList?.contains('engaged') });
    this.lenis.stop();
  }

  add(ch: Chapter): void {
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || ch.done || this.active) continue;
          // Only when arriving from above.
          if (e.boundingClientRect.top > 0) this.engage(ch);
        }
      },
      { threshold: 0.42 },
    ).observe(ch.section);
  }

  /** Called at the blessing: the page can scroll from here on. */
  start(from: HTMLElement): void {
    if (this.started) return;
    this.started = true;
    document.documentElement.classList.remove('locked');
    this.lenis.start();
    this.cue(from);
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.engage(p);
    }
  }

  private engage(ch: Chapter): void {
    if (!this.started) {
      this.pending = ch;
      return;
    }
    if (ch.done || this.active) return;
    this.active = ch;
    ch.onDone = () => this.release(ch);
    this.lenis.scrollTo(ch.section, {
      duration: 1.1,
      lock: true,
      force: true,
      onComplete: () => {
        this.lenis.stop();
        ch.section.classList.add('engaged');
        ch.engage();
      },
    });
  }

  private release(ch: Chapter): void {
    ch.section.classList.remove('engaged');
    this.active = null;
    this.lenis.start();
    this.cue(ch.section);
  }

  /** A quiet "scroll down" hint at the bottom of a section; gone once the page moves. */
  private cue(section: HTMLElement): void {
    if (section.querySelector('.cue')) return;
    const el = document.createElement('div');
    el.className = 'cue';
    const label = section.id === 'intro' ? config.copy.intro.scrollCue : config.copy.ui.next;
    el.innerHTML = `<span>${label}</span><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
    section.appendChild(el);
    setTimeout(() => el.classList.add('on'), 50);
    const start = window.scrollY;
    const off = () => {
      if (Math.abs(window.scrollY - start) < 40) return;
      el.classList.remove('on');
      setTimeout(() => el.remove(), 900);
      window.removeEventListener('scroll', off);
    };
    window.addEventListener('scroll', off, { passive: true });
  }

  toTop(): void {
    this.lenis.scrollTo(0, { duration: 1.6, force: true });
  }
}
