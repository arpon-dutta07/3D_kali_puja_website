import { gsap } from 'gsap';

/**
 * Text and buttons over a scene. Lines fade in with a small rise and a blur-to-sharp (CSS), never typewriter.
 */
export interface Line {
  bn: string;
  en?: string;
}

type Pos = 'top' | 'upper' | 'center' | 'bottom';

export class Overlay {
  readonly root: HTMLElement;
  private lines = new Map<string, HTMLElement>();
  private timers = new Map<string, gsap.core.Tween>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ov';
    parent.appendChild(this.root);
  }

  /** Show a line (replacing any line with the same id). `hold` seconds later it fades out by itself. */
  say(id: string, line: Line | string, pos: Pos = 'top', hold = 0, extraClass = ''): HTMLElement {
    this.hide(id, true);
    const l = typeof line === 'string' ? { bn: line } : line;
    const el = document.createElement('div');
    el.className = `line pos-${pos} ${extraClass}`;
    el.innerHTML = `<p class="bn">${l.bn}</p>${l.en ? `<p class="en">${l.en}</p>` : ''}`;
    this.root.appendChild(el);
    this.lines.set(id, el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    // Fallback for hidden tabs, where rAF does not run.
    setTimeout(() => el.classList.add('on'), 60);
    // On the page clock (gsap), so holds line up with the scene's own timing.
    if (hold > 0) this.timers.set(id, gsap.delayedCall(hold, () => this.hide(id)));
    return el;
  }

  hide(id: string, instant = false): void {
    this.timers.get(id)?.kill();
    this.timers.delete(id);
    const el = this.lines.get(id);
    if (!el) return;
    this.lines.delete(id);
    if (instant) {
      el.remove();
      return;
    }
    el.classList.remove('on');
    el.classList.add('off');
    setTimeout(() => el.remove(), 1200);
  }

  clear(): void {
    for (const id of [...this.lines.keys()]) this.hide(id);
  }

  /** A row of buttons; returns the container so the caller can remove it. */
  buttons(id: string, items: Array<{ label: string; sub?: string; onClick: () => void; primary?: boolean }>, pos: Pos = 'bottom'): HTMLElement {
    this.hide(id, true);
    const el = document.createElement('div');
    el.className = `line buttons pos-${pos}`;
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${it.primary ? ' primary' : ''}`;
      b.innerHTML = `<span>${it.label}</span>${it.sub ? `<small>${it.sub}</small>` : ''}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        it.onClick();
      });
      el.appendChild(b);
    }
    this.root.appendChild(el);
    this.lines.set(id, el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    setTimeout(() => el.classList.add('on'), 60);
    return el;
  }
}

/** Small corner controls: Skip and the counter. */
export function cornerButton(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'corner';
  b.textContent = `${label} ›`;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  parent.appendChild(b);
  return b;
}

export function counter(parent: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'counter';
  parent.appendChild(el);
  return el;
}
