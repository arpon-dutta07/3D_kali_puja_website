import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Plain stand-ins drawn in code so every scene works before the real art (art/PROMPTS.md) is generated.
 * Deliberately simple shapes: they are scaffolding, not the look of the site.
 */
function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function prodipBowl(): CanvasTexture {
  return tex(256, 160, (c) => {
    const g = c.createLinearGradient(0, 60, 0, 150);
    g.addColorStop(0, '#b8653c');
    g.addColorStop(1, '#4a1e10');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(16, 70);
    c.quadraticCurveTo(128, 190, 240, 70);
    c.lineTo(16, 70);
    c.fill();
    c.fillStyle = '#c8784a';
    c.beginPath();
    c.ellipse(128, 70, 112, 13, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a1206';
    c.beginPath();
    c.ellipse(128, 71, 100, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8d090';
    c.fillRect(124, 56, 8, 14);
  });
}

export function candle(): CanvasTexture {
  return tex(128, 192, (c) => {
    c.fillStyle = '#8a4a2a';
    c.beginPath();
    c.ellipse(64, 170, 54, 12, 0, 0, Math.PI * 2);
    c.fill();
    const g = c.createLinearGradient(30, 0, 98, 0);
    g.addColorStop(0, '#cfc6b4');
    g.addColorStop(0.5, '#fbf6ea');
    g.addColorStop(1, '#bdb3a0');
    c.fillStyle = g;
    c.fillRect(34, 70, 60, 100);
    c.fillStyle = '#efe8d8';
    c.beginPath();
    c.ellipse(64, 70, 30, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#222';
    c.fillRect(62, 52, 4, 18);
  });
}

export function stone(): CanvasTexture {
  const t = tex(512, 512, (c, w, h) => {
    const r = rng(7);
    c.fillStyle = '#6e6152';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 70 + r() * 60;
      c.fillStyle = `rgba(${v},${v * 0.9},${v * 0.78},${0.08 + r() * 0.12})`;
      c.fillRect(r() * w, r() * h, 2 + r() * 14, 2 + r() * 14);
    }
    c.strokeStyle = 'rgba(30,22,16,0.45)';
    c.lineWidth = 3;
    for (let y = 0; y <= h; y += 128) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let y = 0; y < h; y += 128) {
      for (let x = (y / 128) % 2 ? 64 : 0; x < w; x += 256) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 128);
        c.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function shrine(): CanvasTexture {
  return tex(1600, 900, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a1a14');
    g.addColorStop(1, '#3c2418');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5a1810';
    c.beginPath();
    c.moveTo(w * 0.3, h);
    c.lineTo(w * 0.3, h * 0.35);
    c.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.7, h * 0.35);
    c.lineTo(w * 0.7, h);
    c.fill();
    c.strokeStyle = '#8a5a34';
    c.lineWidth = 14;
    c.stroke();
    c.fillStyle = '#4a3a2e';
    c.fillRect(w * 0.26, h * 0.86, w * 0.48, h * 0.14);
  });
}

/** Abstract stand-in for the pratima: a dark standing form with a halo. Replaced by intro/ma.webp. */
export function maStandIn(withGarland = false): CanvasTexture {
  return tex(768, 1024, (c, w, h) => {
    const halo = c.createRadialGradient(w / 2, h * 0.24, w * 0.12, w / 2, h * 0.24, w * 0.42);
    halo.addColorStop(0, 'rgba(232,181,74,0.0)');
    halo.addColorStop(0.75, 'rgba(232,181,74,0.55)');
    halo.addColorStop(0.82, 'rgba(196,18,43,0.5)');
    halo.addColorStop(1, 'rgba(196,18,43,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);
    const body = c.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, '#1b2238');
    body.addColorStop(1, '#0d1222');
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(w / 2, h * 0.24, w * 0.11, w * 0.13, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(w * 0.36, h * 0.33);
    c.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.64, h * 0.33);
    c.lineTo(w * 0.7, h * 0.86);
    c.lineTo(w * 0.3, h * 0.86);
    c.closePath();
    c.fill();
    c.fillStyle = '#2a2622';
    c.fillRect(w * 0.18, h * 0.86, w * 0.64, h * 0.07);
    c.fillStyle = '#e8b54a';
    c.beginPath();
    c.moveTo(w * 0.4, h * 0.16);
    c.lineTo(w * 0.5, h * 0.06);
    c.lineTo(w * 0.6, h * 0.16);
    c.closePath();
    c.fill();
    if (withGarland) {
      c.fillStyle = '#c4122b';
      for (let i = 0; i < 26; i++) {
        const t = i / 25;
        const x = w * (0.4 + 0.2 * t) + Math.sin(t * Math.PI) * 0;
        const y = h * (0.33 + Math.sin(t * Math.PI) * 0.3);
        c.beginPath();
        c.arc(x, y, w * 0.022, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}

export function jaba(variant: number): CanvasTexture {
  return tex(256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w * 0.46);
    g.addColorStop(0, '#7a0614');
    g.addColorStop(0.25, ['#d0182e', '#c40f27', '#b8102a', '#d42234'][variant % 4]!);
    g.addColorStop(0.9, '#e0283a');
    g.addColorStop(1, 'rgba(224,40,58,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f2c94c';
    c.beginPath();
    c.arc(w / 2 + 10, w / 2 - 8, 7, 0, Math.PI * 2);
    c.fill();
  });
}

export function thala(): CanvasTexture {
  return tex(1024, 1024, (c, w) => {
    c.fillStyle = '#1a0f0a';
    c.fillRect(0, 0, w, w);
    c.fillStyle = '#efe6d6';
    c.fillRect(w * 0.04, w * 0.04, w * 0.92, w * 0.92);
    c.fillStyle = '#a3121f';
    c.fillRect(w * 0.04, w * 0.04, w * 0.92, w * 0.05);
    c.fillRect(w * 0.04, w * 0.91, w * 0.92, w * 0.05);
    const rim = c.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w * 0.45);
    rim.addColorStop(0, '#6b4a14');
    rim.addColorStop(0.5, '#d8a845');
    rim.addColorStop(1, '#7a5418');
    c.fillStyle = rim;
    c.beginPath();
    c.arc(w / 2, w / 2, w * 0.45, 0, Math.PI * 2);
    c.fill();
    const water = c.createRadialGradient(w * 0.45, w * 0.45, 10, w / 2, w / 2, w * 0.38);
    water.addColorStop(0, '#2a3a3c');
    water.addColorStop(1, '#0e1616');
    c.fillStyle = water;
    c.beginPath();
    c.arc(w / 2, w / 2, w * 0.38, 0, Math.PI * 2);
    c.fill();
  });
}

/** Cut-away house: three floors, a staircase and a courtyard, as flat blocks. */
export function house(): CanvasTexture {
  return tex(900, 1600, (c, w, h) => {
    c.fillStyle = '#c9b48f';
    c.fillRect(0, 0, w, h);
    const floor = (y: number, hh: number, col: string) => {
      c.fillStyle = col;
      c.fillRect(w * 0.06, y, w * 0.88, hh);
      c.fillStyle = '#5a4030';
      c.fillRect(w * 0.04, y + hh, w * 0.92, 16);
    };
    c.fillStyle = '#1d2a44';
    c.fillRect(0, 0, w, h * 0.14);
    floor(h * 0.14, h * 0.2, '#d8c3a0');
    floor(h * 0.35, h * 0.2, '#cdb48c');
    floor(h * 0.56, h * 0.2, '#c2a882');
    c.fillStyle = '#6a8a52';
    c.fillRect(0, h * 0.78, w, h * 0.22);
    // Staircase on the right.
    c.fillStyle = '#7a5434';
    for (let i = 0; i < 24; i++) c.fillRect(w * 0.74 + (i % 8) * 6, h * 0.76 - i * h * 0.026, w * 0.18, 8);
    // Windows, bed, almirah, kitchen shelf, tulsi mancha, water tank.
    c.fillStyle = '#2f6b4a';
    c.fillRect(w * 0.12, h * 0.18, w * 0.12, h * 0.1);
    c.fillStyle = '#6a3e22';
    c.fillRect(w * 0.3, h * 0.24, w * 0.3, h * 0.08);
    c.fillRect(w * 0.12, h * 0.4, w * 0.12, h * 0.14);
    c.fillStyle = '#8f8f8f';
    c.fillRect(w * 0.2, h * 0.62, w * 0.36, h * 0.03);
    c.fillStyle = '#a0502e';
    c.fillRect(w * 0.44, h * 0.86, w * 0.12, h * 0.06);
    c.fillStyle = '#222';
    c.fillRect(w * 0.6, h * 0.06, w * 0.16, h * 0.08);
  });
}

export function ghost(variant: number): CanvasTexture {
  return tex(256, 384, (c, w, h) => {
    c.fillStyle = '#1b1838';
    c.beginPath();
    c.moveTo(w * 0.2, h * 0.95);
    c.quadraticCurveTo(w * 0.1, h * 0.2, w * 0.5, h * 0.12);
    c.quadraticCurveTo(w * 0.9, h * 0.2, w * 0.8, h * 0.95);
    for (let i = 0; i < 4; i++) c.quadraticCurveTo(w * (0.72 - i * 0.15), h * 0.85, w * (0.65 - i * 0.15), h * 0.95);
    c.fill();
    if (variant % 2) {
      c.fillRect(w * 0.02, h * 0.42, w * 0.25, 18);
      c.fillRect(w * 0.73, h * 0.42, w * 0.25, 18);
    }
    c.fillStyle = '#ffe9a0';
    c.beginPath();
    c.arc(w * 0.42, h * 0.3, 9, 0, Math.PI * 2);
    c.arc(w * 0.58, h * 0.3, 9, 0, Math.PI * 2);
    c.fill();
  });
}

/** A row of rooftops against the blue hour. `lit` adds lamps along every roof and warm windows. */
export function city(lit: boolean): CanvasTexture {
  return tex(1600, 900, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, lit ? '#060a1c' : '#0d1838');
    sky.addColorStop(0.75, lit ? '#14183a' : '#26305a');
    sky.addColorStop(1, lit ? '#3a2430' : '#8a4a3a');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    const r = rng(42);
    const rows = [
      { base: h * 0.62, hMin: 60, hMax: 160, col: '#0b0d18', win: 0.05 },
      { base: h * 0.8, hMin: 90, hMax: 230, col: '#07080f', win: 0.08 },
    ];
    for (const row of rows) {
      let x = -20;
      while (x < w) {
        const bw = 70 + r() * 150;
        const bh = row.hMin + r() * (row.hMax - row.hMin);
        const top = row.base - bh;
        c.fillStyle = row.col;
        c.fillRect(x, top, bw, h - top);
        if (r() < 0.4) c.fillRect(x + bw * 0.2, top - 26, bw * 0.3, 26);
        for (let wy = top + 14; wy < h; wy += 26) {
          for (let wx = x + 10; wx < x + bw - 12; wx += 22) {
            if (r() < (lit ? row.win * 5 : row.win)) {
              c.fillStyle = lit ? '#ffcf7a' : '#e8b060';
              c.fillRect(wx, wy, 9, 12);
            }
          }
        }
        if (lit) {
          for (let lx = x + 6; lx < x + bw; lx += 12) {
            c.fillStyle = r() < 0.5 ? '#ffd27a' : '#ff9a4a';
            c.beginPath();
            c.arc(lx, top - 2, 2.6, 0, Math.PI * 2);
            c.fill();
          }
        }
        x += bw + 4;
      }
    }
  });
}

export function parapet(): CanvasTexture {
  return tex(1600, 900, (c, w, h) => {
    const top = h * 0.66;
    const g = c.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, '#b9a98a');
    g.addColorStop(0.08, '#8f7f64');
    g.addColorStop(1, '#5a4d3c');
    c.fillStyle = g;
    c.fillRect(0, top, w, h - top);
    c.fillStyle = '#cdbd9c';
    c.fillRect(0, top - 10, w, 22);
    const r = rng(3);
    for (let i = 0; i < 700; i++) {
      c.fillStyle = `rgba(40,30,20,${r() * 0.12})`;
      c.fillRect(r() * w, top + 12 + r() * (h - top), 2 + r() * 20, 1 + r() * 6);
    }
  });
}

export function lantern(): CanvasTexture {
  return tex(256, 384, (c, w, h) => {
    c.strokeStyle = '#3a2a1a';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.lineTo(w / 2, h * 0.14);
    c.stroke();
    const g = c.createLinearGradient(0, h * 0.14, 0, h * 0.9);
    g.addColorStop(0, '#f6e8cc');
    g.addColorStop(1, '#e8c890');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.14);
    c.lineTo(w * 0.85, h * 0.4);
    c.lineTo(w * 0.72, h * 0.9);
    c.lineTo(w * 0.28, h * 0.9);
    c.lineTo(w * 0.15, h * 0.4);
    c.closePath();
    c.fill();
    c.strokeStyle = '#8a6a3a';
    c.lineWidth = 3;
    c.stroke();
  });
}

export function pole(): CanvasTexture {
  return tex(64, 1024, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#5a4424');
    g.addColorStop(0.5, '#a88a54');
    g.addColorStop(1, '#4a3820');
    c.fillStyle = g;
    c.fillRect(w * 0.3, 20, w * 0.4, h - 20);
    c.fillStyle = 'rgba(30,20,10,0.6)';
    for (let y = 120; y < h; y += 140) c.fillRect(w * 0.28, y, w * 0.44, 6);
    c.fillStyle = '#333';
    c.beginPath();
    c.arc(w / 2, 20, 14, 0, Math.PI * 2);
    c.fill();
  });
}

export function tubri(): CanvasTexture {
  return tex(192, 192, (c, w, h) => {
    c.fillStyle = '#9a4a26';
    c.beginPath();
    c.ellipse(w / 2, h * 0.66, w * 0.34, h * 0.28, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(w * 0.42, h * 0.24, w * 0.16, h * 0.2);
    c.fillStyle = '#c4122b';
    c.fillRect(w * 0.4, h * 0.16, w * 0.2, h * 0.1);
  });
}
