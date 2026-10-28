// Turns the generated art in art/raw/ into the WebPs the site loads from public/assets/.
// Cut-outs (key: true) lose their #00B140 green background; `split` cuts a sheet of several sprites into
// numbered files; pairs that cross-fade (trim: false) keep their exact canvas so they stay aligned.
// Usage: npm run art            (all files that exist)
//        npm run art -- jaba    (only entries whose name contains "jaba")
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'art', 'raw');
const OUT = path.join(ROOT, 'public', 'assets');

/** src: file in art/raw without extension. out: path in public/assets. */
const ART = [
  { src: 'intro/ma', out: 'intro/ma.webp', key: true, trim: false, max: 2048 },
  { src: 'intro/ma-mala', out: 'intro/ma-mala.webp', key: true, trim: false, max: 2048 },
  { src: 'intro/shrine', out: 'intro/shrine.webp', max: 2560 },
  { src: 'intro/stone', out: 'intro/stone.webp', max: 1024 },
  { src: 'intro/prodip', out: 'common/prodip.webp', key: true, max: 384 },
  { src: 'intro/petals', out: 'common/petal.webp', key: true, split: true, max: 256 },
  { src: 'mala/thala', out: 'mala/thala.webp', max: 2048 },
  { src: 'mala/jaba', out: 'mala/jaba.webp', key: true, split: true, max: 512 },
  { src: 'bhoot/house', out: 'bhoot/house.webp', max: 2730 },
  { src: 'bhoot/ghosts', out: 'bhoot/ghost.webp', key: true, split: true, max: 768 },
  { src: 'chhad/city', out: 'chhad/city.webp', trim: false, max: 2560 },
  { src: 'chhad/city-lit', out: 'chhad/city-lit.webp', trim: false, max: 2560 },
  { src: 'chhad/parapet', out: 'chhad/parapet.webp', key: true, keepGreens: true, max: 2560 },
  { src: 'chhad/akash-prodip', out: 'chhad/akash-prodip.webp', key: true, max: 512 },
  { src: 'chhad/pole', out: 'chhad/pole.webp', key: true, max: 2048 },
  { src: 'chhad/candle', out: 'chhad/candle.webp', key: true, max: 320 },
  { src: 'chhad/tubri', out: 'chhad/tubri.webp', key: true, cropTop: 0.6, max: 384 },
];

const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function findRaw(src) {
  for (const ext of EXTS) {
    const p = path.join(RAW, src + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Green-ness = G - max(R, B). Soft alpha between 18 and 70, then despill the edge so no green fringe is left. */
function keyGreen(data) {
  let opaque = 0;
  let green = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxRB = Math.max(r, b);
    const gd = Math.max(0, g - maxRB);
    const a = Math.round((1 - smoothstep(18, 70, gd)) * data[i + 3]);
    if (a < 255 || gd > 0) data[i + 1] = Math.min(g, maxRB + 6);
    data[i + 3] = a;
    if (a > 128) {
      opaque++;
      if (gd > 20) green++;
    }
  }
  return opaque ? green / opaque : 0;
}

/** Alpha from the distance to the background colour (sampled at the corners), so greens unlike it survive. */
function keyByDistance(data, w, h) {
  const corner = (x, y) => [data[(y * w + x) * 4], data[(y * w + x) * 4 + 1], data[(y * w + x) * 4 + 2]];
  const cs = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const bg = [0, 1, 2].map((k) => cs.map((c) => c[k]).sort((a, b) => a - b)[1]);
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    const a = smoothstep(38, 95, d);
    const maxRB = Math.max(data[i], data[i + 2]);
    // Despill only the soft edge, where the green background shows through.
    if (a < 1) data[i + 1] = Math.round(data[i + 1] * a + Math.min(data[i + 1], maxRB + 6) * (1 - a));
    data[i + 3] = Math.round(a * data[i + 3]);
  }
}

/** Bounding boxes of separate sprites on a keyed sheet (coarse flood fill on a downsampled alpha grid). */
function components(data, w, h) {
  const s = Math.max(1, Math.floor(Math.max(w, h) / 512));
  const sw = Math.floor(w / s);
  const sh = Math.floor(h / s);
  const seen = new Uint8Array(sw * sh);
  const alphaAt = (x, y) => data[(y * s * w + x * s) * 4 + 3];
  const boxes = [];
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (seen[y * sw + x]) continue;
      seen[y * sw + x] = 1;
      if (alphaAt(x, y) < 30) continue;
      let x0 = x, x1 = x, y0 = y, y1 = y, n = 0;
      const q = [x, y];
      for (let k = 0; k < q.length; k += 2) {
        const cx = q[k];
        const cy = q[k + 1];
        n++;
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 0 || ny < 0 || nx >= sw || ny >= sh || seen[ny * sw + nx]) continue;
          seen[ny * sw + nx] = 1;
          if (alphaAt(nx, ny) >= 30) q.push(nx, ny);
        }
      }
      if (n < sw * sh * 0.004) continue;
      const left = Math.max(0, (x0 - 2) * s);
      const top = Math.max(0, (y0 - 2) * s);
      boxes.push({ left, top, width: Math.min(w - left, (x1 - x0 + 4) * s), height: Math.min(h - top, (y1 - y0 + 4) * s) });
    }
  }
  // Reading order: rows first, then left to right.
  const rowH = h / 4;
  boxes.sort((a, b) => Math.floor(a.top / rowH) - Math.floor(b.top / rowH) || a.left - b.left);
  return boxes;
}

async function write(raw, w, h, outPath, { max, trim = true }) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let img = sharp(raw, { raw: { width: w, height: h, channels: 4 } });
  if (trim) img = sharp(await img.png().toBuffer()).trim({ threshold: 1 });
  await img
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 90, effort: 5 })
    .toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`  -> ${path.relative(ROOT, outPath)} ${meta.width}x${meta.height} ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
}

async function run(entry) {
  const file = findRaw(entry.src);
  if (!file) return false;
  console.log(`${path.relative(ROOT, file)}`);
  const outPath = path.join(OUT, entry.out);
  if (!entry.key) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sharp(file)
      .rotate()
      .resize({ width: entry.max, height: entry.max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(outPath);
    const meta = await sharp(outPath).metadata();
    console.log(`  -> ${path.relative(ROOT, outPath)} ${meta.width}x${meta.height} ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
    return true;
  }
  let img = sharp(file).rotate();
  if (entry.cropTop) {
    const m = await sharp(file).rotate().metadata();
    const top = Math.round(m.height * entry.cropTop);
    img = sharp(await img.extract({ left: 0, top, width: m.width, height: m.height - top }).png().toBuffer());
  }
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (entry.keepGreens) keyByDistance(data, info.width, info.height);
  else {
    const leftover = keyGreen(data);
    if (leftover > 0.02) console.warn(`  ! ${(leftover * 100).toFixed(1)}% of the subject is still green. Check the background colour.`);
  }
  if (!entry.split) {
    await write(data, info.width, info.height, outPath, entry);
    return true;
  }
  const boxes = components(data, info.width, info.height);
  console.log(`  found ${boxes.length} sprites`);
  const base = outPath.slice(0, -'.webp'.length);
  for (const [i, box] of boxes.entries()) {
    const part = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract(box)
      .raw()
      .toBuffer();
    await write(part, box.width, box.height, `${base}-${i + 1}.webp`, entry);
  }
  return true;
}

const filter = process.argv[2] ?? '';
let done = 0;
for (const entry of ART) {
  if (filter && !entry.src.includes(filter)) continue;
  if (await run(entry)) done++;
}
const missing = ART.filter((e) => !findRaw(e.src)).map((e) => e.src);
console.log(`\n${done} processed.${missing.length ? ` Still missing: ${missing.join(', ')}` : ' All art is in.'}`);
