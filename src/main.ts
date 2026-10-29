import './style.css';
import { config } from './config';
import { Journey, type Chapter } from './journey';
import { Intro } from './scenes/intro';
import { Mala } from './scenes/mala';
import { Bhoot } from './scenes/bhoot';
import { Chhad } from './scenes/chhad';
import { Baji } from './scenes/baji';
import { EndScene } from './scenes/end';
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

const END_FLAME = `<svg viewBox="0 0 24 32" aria-hidden="true"><defs><linearGradient id="fl-end" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a2a"/><stop offset=".55" stop-color="#ffb347"/><stop offset="1" stop-color="#fff2c8"/></linearGradient></defs><path d="M12 1C14 7 20 10 20 18a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 5 3 6-1-5 0-10 1-15z" fill="url(#fl-end)"/><path d="M12 14c1.5 2.5 3.5 3.5 3.5 6.5a3.5 3.5 0 0 1-7 0c0-2 1-3 2-4 .2 1.2.8 2 1.6 2.4-.4-1.8-.4-3.4-.1-4.9z" fill="#fff6dc"/></svg>`;

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
    return;
  }

  const journey = new Journey();
  const intro = new Intro(introEl);

  // Chapters follow the opening in story order; each one's title appears inside its own scene.
  const C = config.copy;
  const chapters: Array<{ id: string; title: string; line: string; make: (el: HTMLElement) => Chapter }> = [
    { id: 'mala', title: C.mala.title, line: C.mala.line, make: (el) => new Mala(el) },
    { id: 'bhoot', title: C.bhoot.title, line: C.bhoot.line, make: (el) => new Bhoot(el) },
    { id: 'chhad', title: C.chhad.title, line: C.chhad.line, make: (el) => new Chhad(el) },
    { id: 'baji', title: C.baji.title, line: C.baji.line, make: (el) => new Baji(el) },
  ];
  const numbers = ['এক', 'দুই', 'তিন', 'চার'];
  const built: Record<string, Chapter> = {};
  chapters.forEach((c, i) => {
    const el = sceneSection(c.id);
    page.appendChild(el);
    const ch = c.make(el);
    built[c.id] = ch;
    journey.add(ch, { num: numbers[i] ?? '', title: c.title, line: c.line });
    void ch.init();
  });

  // The last screen: fireworks over the city, the greeting low like a poster's title, Share and Watch again.
  const end = sceneSection('end');
  end.classList.add('end');
  end.insertAdjacentHTML(
    'beforeend',
    `<div class="end-scrim"></div><div class="end-card"><p class="kicker">${C.end.kicker}</p><h2>${C.end.title}</h2><div class="rule"><span></span>${END_FLAME}<span></span></div><p class="sub">${C.end.sub}</p><div class="buttons"></div><p class="credit">বানিয়েছে <a href="https://www.instagram.com/lyadkhor.coder/" target="_blank" rel="noopener">@lyadkhor.coder</a></p></div>`,
  );
  const row = end.querySelector<HTMLElement>('.buttons')!;
  const btn = (label: string, primary: boolean, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn${primary ? ' primary' : ''}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    row.appendChild(b);
  };
  btn(C.ui.share, true, () => void share(intro.stage));
  btn(C.ui.again, false, () => {
    journey.toTop();
    setTimeout(() => location.reload(), 1200);
  });
  page.appendChild(end);
  const endScene = new EndScene(end);
  void endScene.init();

  if (isDebug) (window as unknown as { __kali: unknown }).__kali = { intro, journey, advance, chapters: built, end: endScene };
  await intro.init();
}

void boot();
