import { config } from '../config';
import type { Stage } from '../gl/stage';
import { isTouch } from '../lib/device';
import { journal } from '../lib/journal';

/**
 * The story card: a 1080x1920 picture of the visitor's night for their Instagram story, with the greeting and a line
 * of what they did. Nothing is printed on it to brand it; the page travels as the @ tag they add, which the button
 * copies for them.
 */
const W = 1080;
const H = 1920;

/** Frames kept from the night (Ma's face in the fireworks), for the card. */
const moments = new Map<string, HTMLCanvasElement>();

/** Copy what a stage shows right now (drawn straight after rendering, while the frame is still there). */
export function grab(stage: Stage): HTMLCanvasElement {
  stage.render();
  const src = stage.canvas;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')?.drawImage(src, 0, 0);
  return c;
}

export function keepMoment(name: string, stage: Stage): void {
  moments.set(name, grab(stage));
}

export function moment(name: string): HTMLCanvasElement | null {
  return moments.get(name) ?? null;
}

/** Split the journal into at most two centred lines that fit the card. */
function wrap(ctx: CanvasRenderingContext2D, parts: string[], max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const p of parts) {
    const next = line ? `${line}  ·  ${p}` : p;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = p;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export async function storyCard(picture: HTMLCanvasElement): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  try {
    await document.fonts.load('150px "Tiro Bangla"');
  } catch {
    /* Falls back to a system Bengali font. */
  }
  ctx.fillStyle = config.palette.night;
  ctx.fillRect(0, 0, W, H);
  // The picture fills the card.
  const s = Math.max(W / picture.width, H / picture.height);
  const dw = picture.width * s;
  const dh = picture.height * s;
  ctx.drawImage(picture, (W - dw) / 2, (H - dh) / 2, dw, dh);
  // Dark at the top (under Instagram's own bar) and at the bottom (under the words).
  const top = ctx.createLinearGradient(0, 0, 0, 360);
  top.addColorStop(0, 'rgba(3,2,2,0.7)');
  top.addColorStop(1, 'rgba(3,2,2,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 360);
  const low = ctx.createLinearGradient(0, 1020, 0, H);
  low.addColorStop(0, 'rgba(3,2,2,0)');
  low.addColorStop(0.3, 'rgba(3,2,2,0.78)');
  low.addColorStop(1, 'rgba(3,2,2,0.96)');
  ctx.fillStyle = low;
  ctx.fillRect(0, 1020, W, H - 1020);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // শুভ দীপাবলি in the same gold as the site.
  const gold = ctx.createLinearGradient(0, 1270, 0, 1420);
  gold.addColorStop(0, '#fff4d8');
  gold.addColorStop(0.48, '#f4c96e');
  gold.addColorStop(1, '#c27b2e');
  ctx.shadowColor = 'rgba(255,140,60,0.5)';
  ctx.shadowBlur = 36;
  ctx.fillStyle = gold;
  ctx.font = '150px "Tiro Bangla", serif';
  ctx.fillText(config.copy.end.title, W / 2, 1405);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f6e4c4';
  ctx.font = '58px "Tiro Bangla", serif';
  ctx.fillText(config.copy.end.sub, W / 2, 1490);

  // A thin gold rule, then what they did tonight.
  const rule = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0);
  rule.addColorStop(0, 'rgba(232,181,74,0)');
  rule.addColorStop(0.5, 'rgba(232,181,74,0.9)');
  rule.addColorStop(1, 'rgba(232,181,74,0)');
  ctx.fillStyle = rule;
  ctx.fillRect(W / 2 - 160, 1538, 320, 2);
  ctx.fillStyle = 'rgba(243,230,207,0.82)';
  ctx.font = '38px "Tiro Bangla", serif';
  wrap(ctx, journal.lines(), 930).forEach((l, i) => ctx.fillText(l, W / 2, 1608 + i * 58));
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
}

/** Copy the @ handle, so it can be pasted straight into the story's mention. */
function copyHandle(): void {
  void navigator.clipboard?.writeText(`@${config.instagram}`).catch(() => {});
}

/**
 * Sharing one card. It is made ahead of time, so the tap can open the phone's share sheet straight away (phones only
 * allow that right at the tap); where a file cannot be shared (a computer, some in-app browsers) the card opens on the
 * page to save instead.
 */
export class StoryShare {
  private blob: Blob | null = null;
  private making: Promise<Blob | null> | null = null;

  constructor(private make: () => Promise<Blob | null>) {}

  prepare(): void {
    this.making = this.make().then((b) => (this.blob = b));
  }

  async open(): Promise<void> {
    copyHandle();
    const blob = this.blob ?? (await (this.making ?? this.make()));
    if (!blob) return;
    const file = new File([blob], 'kali-puja-2026-story.jpg', { type: 'image/jpeg' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (isTouch() && nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    await showSheet(blob);
  }
}

/** The card on the page, to save: long-press on a phone, the Save button on a computer. */
async function showSheet(blob: Blob): Promise<void> {
  const c = config.copy.story;
  const data = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
  const el = document.createElement('div');
  el.className = 'story-sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', c.sheetTitle);
  el.innerHTML = `<div class="inner"><img alt="${c.sheetTitle}" src="${data}"><p class="hint">${isTouch() ? c.saveTouch : c.tag}<br><span>${c.copied}</span></p><div class="row"><a class="btn primary" download="kali-puja-2026-story.jpg" href="${data}">${c.save}</a><button type="button" class="btn">${c.close}</button></div></div>`;
  const close = () => {
    el.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  el.querySelector('button')!.addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  window.addEventListener('keydown', onKey);
  document.body.appendChild(el);
}

const STORY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-dasharray="4.2 2.4"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>';
const CAMERA_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.2" cy="6.8" r="0.9"/></svg>';

/** The tag line and the Story button (plus any other buttons for the same row). */
export function storyCta(parent: HTMLElement, share: StoryShare, extra: HTMLElement[] = []): HTMLElement {
  const c = config.copy.story;
  const el = document.createElement('div');
  el.className = 'story-cta';
  el.innerHTML = `<p class="tag">${c.tag}</p><div class="row"></div>`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn primary story-btn';
  b.setAttribute('aria-label', c.buttonEn);
  b.innerHTML = `${STORY_ICON}<span>${c.button}</span>`;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    el.querySelector('.tag')!.textContent = c.copied;
    void share.open();
  });
  el.querySelector('.row')!.append(b, ...extra);
  parent.appendChild(el);
  return el;
}

/** The reason to follow: what is coming next, and one tap to the page. */
export function followBlock(parent: HTMLElement): HTMLElement {
  const f = config.copy.follow;
  const el = document.createElement('div');
  el.className = 'follow';
  el.innerHTML = `<p><span>${f.next}</span> <span>${f.nudge}</span></p><a class="btn follow-btn" href="https://www.instagram.com/${config.instagram}/" target="_blank" rel="noopener">${CAMERA_ICON}<span>${f.button}</span></a>`;
  parent.appendChild(el);
  return el;
}
