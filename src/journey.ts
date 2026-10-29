import { gsap } from 'gsap';
import { config } from './config';

/** A full-screen interactive chapter. It starts the moment it is mostly on screen; the page never locks. */
export interface Chapter {
  readonly section: HTMLElement;
  done: boolean;
  init(): Promise<void>;
  engage(): void;
  skip(): void;
  onDone: (() => void) | null;
}

export interface ChapterTitle {
  num: string;
  title: string;
  line: string;
}

/**
 * The scroll journey: plain native scrolling (it works the same with a finger, a wheel and a trackpad), each scene
 * snaps softly into place, and the chapter's title appears inside the scene itself before its moment begins.
 */
export class Journey {
  constructor() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  add(ch: Chapter, title: ChapterTitle): void {
    const card = document.createElement('div');
    card.className = 'chapter-title';
    card.innerHTML = `<div class="veil"></div><div class="inner"><p class="num">${title.num}</p><h2>${title.title}</h2><p class="sub">${title.line}</p></div>`;
    ch.section.appendChild(card);
    let started = false;
    new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || started) continue;
          started = true;
          // Title over the scene, then the scene's own instructions take over.
          card.classList.add('on');
          gsap.delayedCall(config.journey.titleSeconds, () => {
            card.classList.remove('on');
            card.classList.add('gone');
            ch.engage();
          });
        }
      },
      { threshold: 0.6 },
    ).observe(ch.section);
  }

  toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
