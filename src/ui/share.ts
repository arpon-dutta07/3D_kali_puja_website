import { config } from '../config';
import type { Stage } from '../gl/stage';

/**
 * A 1080x1350 card from what the stage shows right now, with the greeting. No link printed on the picture; the link
 * travels in the share text instead.
 */
export async function shareCard(stage: Stage): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  try {
    await document.fonts.load('80px "Tiro Bangla"');
  } catch {
    /* Falls back to a system Bengali font. */
  }
  // Draw the frame right after rendering it, while the drawing buffer is still valid.
  stage.render();
  const src = stage.canvas;
  const s = Math.max(W / src.width, H / src.height);
  const dw = src.width * s;
  const dh = src.height * s;
  ctx.fillStyle = config.palette.night;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2 - H * 0.04, dw, dh);
  const fade = ctx.createLinearGradient(0, H * 0.62, 0, H);
  fade.addColorStop(0, 'rgba(5,3,7,0)');
  fade.addColorStop(1, 'rgba(5,3,7,0.92)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,140,60,0.55)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffd7a0';
  ctx.font = '96px "Tiro Bangla", serif';
  ctx.fillText(config.copy.intro.greeting, W / 2, H - 170);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(243,230,207,0.85)';
  ctx.font = '44px "Tiro Bangla", serif';
  ctx.fillText(config.copy.intro.greetingSub, W / 2, H - 96);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
}

export async function share(stage: Stage): Promise<void> {
  const blob = await shareCard(stage);
  const url = location.origin + location.pathname;
  const text = `${config.copy.ui.shareText} ${url}`;
  if (blob) {
    const file = new File([blob], 'kali-puja-2026.jpg', { type: 'image/jpeg' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kali-puja-2026.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* No clipboard access: the download is enough. */
  }
}
