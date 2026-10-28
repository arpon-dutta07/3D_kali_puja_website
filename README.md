# 3D Kali Puja website

An interactive Kali Puja and Diwali night for the web, in the same style as Pujo 2K26 (চক্ষুদান): one opening moment,
then a scroll journey. Each chapter holds the page until its moment is done (or skipped).

| Part | What you do |
| --- | --- |
| **অমাবস্যার ১০৮ প্রদীপ** (opening) | Light one prodip, carry its flame across 108 lamps on the temple steps. The light climbs Ma from her feet to her face; at midnight she is fully seen. Share, Watch again. |
| **জবার মালা** | Pull a needle through red hibiscus floating in a brass thala. The garland is lifted away and Ma is seen wearing it. |
| **ভূত চতুর্দশী** | Power cut in an old North Kolkata house. Carry a prodip through the dark rooms and light 14 lamps; the ghosts flinch from your light and leave. Then the tube lights come back. |
| **ছাদের দীপাবলি** | Light the candles on the parapet, pull the rope to raise the akash prodip, light a tubri, write on the sky with a phuljhuri. The whole city lights up. |

Static site: Vite + TypeScript, three.js, gsap, Lenis. No backend. No sound (phones vibrate on Android).

## Run

```bash
npm install
npm run dev
```

## Art

The site works with plain placeholders until the real art is in.

1. Generate the images in [art/PROMPTS.md](art/PROMPTS.md).
2. Save each one in `art/raw/` with the exact name given there (for example `art/raw/intro/ma.png`).
3. Run `npm run art`. It keys out the green, trims, resizes and writes WebPs to `public/assets/`, and lists what is
   still missing.

The 14 lamp spots in ভূত চতুর্দশী are placed for the house the prompt describes. If the generated house is laid out
differently, open the site with `?debug`, tap where each lamp should go (the spot is printed in the console), and
update `SPOTS` in `src/scenes/bhoot.ts`.

## Where things live

- `src/config.ts`: every tunable number and all copy. The Bengali is a draft; have it read before launch.
- `src/scenes/`: `intro.ts`, `mala.ts`, `bhoot.ts`, `chhad.ts`.
- `src/gl/`: the shared engine (stage and light map, lamps, sparks, camera, placeholders).
- `?debug` in the URL exposes `window.__kali` (the scenes, and `advance(seconds)` to fast-forward).

## Deploy

Vercel, framework Vite, build `npm run build`, output `dist` (already set in `vercel.json`).
