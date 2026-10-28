import './style.css';
import { config } from './config';
import { Journey, type Chapter } from './journey';
import { Intro } from './scenes/intro';
import { Mala } from './scenes/mala';
import { Bhoot } from './scenes/bhoot';
import { Chhad } from './scenes/chhad';
import { share } from './ui/share';
import { isDebug } from './lib/device';
import { advance } from './gl/stage';

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** A chapter title card between scenes: number, name, one line. Fades in when it scrolls into view. */
function card(num: string, title: string, line: string): HTMLElement {
  const el = document.createElement('section');
  el.className = 'card';
  el.innerHTML = `<div class="inner"><p class="num">${num}</p><h2>${title}</h2><p class="sub">${line}</p></div>`;
  new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && el.classList.add('in')), { threshold: 0.35 }).observe(el);
  return el;
}

function sceneSection(id: string): HTMLElement {
  const el = document.createElement('section');
  el.id = id;
  el.className = 'scene';
  el.innerHTML = '<canvas aria-hidden="true"></canvas>';
  return el;
}

async function boot(): Promise<void> {
  const page = document.querySelector<HTMLElement>('#page')!;
  const introEl = document.querySelector<HTMLElement>('#intro')!;
  if (!webglOk()) {
    introEl.innerHTML = `<div class="ov"><div class="line pos-center on"><p class="bn">${config.copy.intro.greeting}</p><p class="en">${config.copy.intro.greetingSub}</p></div></div>`;
    document.documentElement.classList.remove('locked');
    return;
  }

  const journey = new Journey();
  const intro = new Intro(introEl, () => {
    journey.start(introEl);
    intro.overlay.buttons('bless-btn', [
      { label: config.copy.ui.share, onClick: () => void share(intro.stage) },
      { label: config.copy.ui.again, onClick: () => intro.replay() },
    ], 'bottom');
  });

  // Chapters are added below the opening in story order.
  const C = config.copy;
  const chapters: Array<{ id: string; title: string; line: string; make: (el: HTMLElement) => Chapter }> = [
    { id: 'mala', title: C.mala.title, line: C.mala.line, make: (el) => new Mala(el) },
    { id: 'bhoot', title: C.bhoot.title, line: C.bhoot.line, make: (el) => new Bhoot(el) },
    { id: 'chhad', title: C.chhad.title, line: C.chhad.line, make: (el) => new Chhad(el) },
  ];
  const numbers = ['এক', 'দুই', 'তিন', 'চার'];
  const built: Record<string, Chapter> = {};
  chapters.forEach((c, i) => {
    page.appendChild(card(numbers[i] ?? '', c.title, c.line));
    const el = sceneSection(c.id);
    page.appendChild(el);
    const ch = c.make(el);
    built[c.id] = ch;
    journey.add(ch);
    void ch.init();
  });

  if (isDebug) (window as unknown as { __kali: unknown }).__kali = { intro, journey, advance, chapters: built };
  await intro.init();
}

void boot();
