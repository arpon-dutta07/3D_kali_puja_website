# Image prompts

Generate each image, save it under `art/raw/` with exactly the file name shown (any of .png / .jpg / .webp is fine),
then run `npm run art`. That keys out the green, trims, resizes and writes WebPs into `public/assets/`.
Until a file exists the site uses a plain placeholder, so you can add them one at a time.

Rules for every **cut-out** (marked GREEN):
- Background must be one flat chroma green, **#00B140**, edge to edge. No floor, no shadow on the green, no gradient.
- No green anywhere on the subject (no leaves, no green cloth, no green glass).
- Nothing touching the edges of the frame.

Two images are **pairs** (`ma` + `ma-mala`, `city` + `city-lit`). Make the first one, then give the model that exact
image and ask for the edit. Framing, size and position must stay identical, because the site cross-fades between them.

Shared style for the devotional scenes (paste at the end of prompts 1 to 9):

> Photoreal, cinematic, high detail, natural colours, shot on a full-frame camera, no text, no watermark, no logo,
> no frame or border.

---

## Opening: অমাবস্যার ১০৮ প্রদীপ (`art/raw/intro/`)

### 1. `intro/ma.png` (GREEN, portrait 3:4, about 1536x2048)
A traditional Bengal clay pratima of Ma Dakshina Kali as made in Kumartuli for Kali Puja. Front view, full figure from
the top of the crown to the bottom of the base, centred, filling about 85% of the height. She stands upright with her
right foot forward on Lord Shiva, who lies on his back beneath her, calm, eyes closed, ash-white skin. Ma's skin is deep
glossy blue-black. Three eyes, large and kind. Long loose black hair falling to her knees. Tall gold crown with white
shola work. A small red tongue showing. Gold jewellery. Four arms: upper left holds a curved khadga, lower left holds a
small stylised clay head, upper right in abhaya mudra, lower right in varada mudra. A garland of small stylised clay
heads and a skirt of stylised clay arms, clearly painted clay craft, clean and not gory, no blood, not scary.
**No red hibiscus garland** (that comes in the next image). Soft even light from the front so every detail is visible.
Plain flat chroma green background #00B140 all around, no floor, no shadow.

### 2. `intro/ma-mala.png` (GREEN, edit of image 1)
Edit this exact image. Change only one thing: add a long garland of fresh red hibiscus (jaba) flowers around Ma's neck,
hanging down to her knees over the clay garland, about 30 flowers threaded close together on a red thread. Same pose,
same framing, same size and position, same light, same green background. Do not move or redraw anything else.

### 3. `intro/shrine.jpg` (landscape 16:9, 2560x1440)
The back wall of an old Bengal temple sanctum at night for Kali Puja, straight front view. A carved terracotta arch in
the middle, a deep red cloth hanging behind it, an empty raised stone altar platform at the bottom centre (the idol is
added later, so the altar is empty). Dark laterite walls with old lime wash at the sides. Soft even light so every detail
is visible (the site darkens it in code). No lamps, no flowers, no people, no idol.

### 4. `intro/stone.jpg` (square, 2048x2048)
Seamless tileable texture of an old worn temple stone floor seen straight from above: grey-brown sandstone slabs with
soft cracks and oil stains, flat even light, no shadows, no objects.

### 5. `intro/prodip.png` (GREEN, square 1024x1024)
One small unlit earthen clay prodip, the shallow Bengali oil lamp with a pinched spout, unpainted terracotta, a little
mustard oil inside and a white cotton wick resting in the spout. Seen from the front, looking down at about 25 degrees.
Centred, filling about 70% of the width. Plain chroma green background #00B140, no shadow.

### 6. `intro/petals.png` (GREEN, square 2048x2048)
Four single loose red hibiscus petals, each a slightly different shape and curl, arranged in a 2x2 grid with a lot of
empty space between them, seen from above. Plain chroma green background #00B140, no shadows.

---

## Chapter: জবার মালা (`art/raw/mala/`)

### 7. `mala/thala.jpg` (square, 2048x2048)
Straight top-down view from above of a round polished brass (kansa) thala filled with clear water, the water still and
dark, nothing floating in it. The thala fills about 80% of the frame, resting on a white cotton cloth with a red border
on a dark floor. Warm light from one oil lamp just outside the frame on the left.

### 8. `mala/jaba.png` (GREEN, square 2048x2048)
Four fresh red hibiscus (jaba) flowers, each seen straight from above, fully open, five petals, the long stamen with
yellow tips in the middle, no leaves, no stem. Arranged in a 2x2 grid with a lot of empty space between them, each a
little different. Plain chroma green background #00B140, no shadows.

---

## Chapter: ভূত চতুর্দশী (`art/raw/bhoot/`)

Style for this chapter (paste at the end of prompts 9 and 10):

> Detailed digital painting, warm nostalgic storybook feel, like a frame from a Bengali animated film, rich textures,
> not cartoonish, no text, no watermark.

### 9. `bhoot/house.jpg` (portrait 9:16, 1536x2730)
A cut-away cross-section of an old three-storey North Kolkata house at night, like a dollhouse with the front wall
removed, the whole house visible from the roof to the courtyard. Roof: a terrace with a black water tank and a
clothesline with a sari. Top floor: a bedroom with a wooden almirah, a four-poster bed with a mosquito net and a window
with green wooden shutters. Middle floor: a small thakur ghor corner with a shelf, and a sitting room with a radio and a
cane chair. Ground floor: a kitchen with a clay oven and steel utensils on a rack. A wooden staircase on the right goes
up through every floor. At the very bottom: a small courtyard with a tulsi mancha and a guava tree. Ceiling fans and old
tube lights on the walls, switched off. Every room evenly and softly lit so all detail is visible (the site darkens it
in code). No people, no ghosts.

### 10. `bhoot/ghosts.png` (GREEN, landscape 3:2, 2048x1365)
Six Bengali folk ghosts drawn as flat solid dark-indigo silhouettes with no inner detail except two small pale yellow
glowing eyes each. Funny and a little mischievous, not scary. Arranged in a 3x2 grid with plenty of empty space between
them:
1. শাঁকচুন্নি: a thin woman ghost in a sari with long open hair, peeking sideways
2. মেছোভূত: a hunched ghost holding a stolen fish by its tail
3. স্কন্ধকাটা: a headless ghost walking with both arms stretched forward
4. গেছোভূত: a long lanky ghost hanging upside down from a short branch
5. একানড়ে: a tall ghost hopping on one long leg
6. পেত্নী: a small round ghost with very long thin arms, floating
Plain chroma green background #00B140, no shadows.

---

## Chapter: ছাদের দীপাবলি (`art/raw/chhad/`)

### 11. `chhad/city.jpg` (landscape 16:9, 2560x1440)
View from an old North Kolkata rooftop at blue hour just after sunset on Diwali evening, looking across a dense sea of
old rooftops: black water tanks, TV antennas, clotheslines, a temple spire, a few coconut trees, and the Howrah Bridge
small on the far horizon. Only a few windows lit, no festival lights yet. Deep blue sky with a thin orange band at the
horizon. The bottom 25% of the frame is the dark tops of nearby houses.

### 12. `chhad/city-lit.jpg` (edit of image 11)
Edit this exact image. Same framing, every building in the same place. Now it is Diwali night: every rooftop parapet is
lined with small oil lamps and white candles, strings of warm fairy lights hang down the buildings, a few akash prodip
lanterns glow on bamboo poles, most windows glow warm, and the sky is a darker night blue.

### 13. `chhad/parapet.png` (GREEN, landscape 16:9, 2560x1440)
Front view of the top of an old North Kolkata rooftop parapet wall, seen from inside the roof at standing height. Worn
lime-plastered brick with old pale yellow paint, cracks, a little dark moss, a flat ledge along the top. The wall spans
the full width and fills only the bottom 35% of the image. Everything above the wall is plain chroma green #00B140
(the sky is added later). Soft even light.

### 14. `chhad/akash-prodip.png` (GREEN, portrait, 1024x1536)
A traditional Bengali akash prodip: a small hanging lantern of thin bamboo strips covered in white paper, with a small
clay lamp inside, hanging from a short rope loop at the top. Front view, softly glowing warm from inside. Plain chroma
green background #00B140, no shadow.

### 15. `chhad/pole.png` (GREEN, tall portrait, 512x3072)
One tall straight old bamboo pole standing upright, with a small iron pulley at the very top. The pole fills the full
height. Plain chroma green background #00B140.

### 16. `chhad/candle.png` (GREEN, square 768x768)
One short thick white household candle (mombati), unlit, standing on a small terracotta saucer, a little melted wax on
the side. Front view, looking down at about 20 degrees. Plain chroma green background #00B140, no shadow.

### 17. `chhad/tubri.png` (GREEN, square 768x768)
One traditional clay tubri (the earthen-pot fountain firework): a small round terracotta pot with a narrow neck and a
twist of red paper at the top, no printed text. Front view. Plain chroma green background #00B140, no shadow.
