# Antigravity sheet, round 2

New images for the second version of the site. Nothing from round 1 needs redoing except what is listed here.

| Part | What's new | Files |
| --- | --- | --- |
| Opening | Kali Puja decoration on both sides of Ma | 6 cut-outs |
| জবার মালা | One full thala picture that never shows its edges | 1 picture |
| ভূত চতুর্দশী | A wide house for computers, and 7 ghosts (not 14) | 1 picture + 7 cut-outs |
| ছাদের দীপাবলি | One full rooftop picture (no cut-out wall), and its Diwali-night twin | 2 pictures (+2 optional for phones) |

---

## Step 1. Paste this into Antigravity

Open the folder `E:\WEBDEV PROJECTS\kali puja website` in Antigravity, choose an image model, and send:

```
You are generating round 2 of the artwork for this website. Do not change any code and do not commit.

1. Read art/ANTIGRAVITY-ROUND-2.md completely before you start.

2. Generate every image in its "Prompts" section, in order, one image per prompt. Add the style block the
   section names at the end of each prompt. Use the prompt wording exactly; don't shorten it.

3. Save each image under art/raw/ with the exact path and name in its heading, for example
   art/raw/intro/decor-lamp-tree.png or art/raw/chhad/rooftop.jpg. Never rename, never add words to the name.
   Create the folders intro, mala, bhoot, chhad if they're missing.

4. Backgrounds:
   - Images marked GREEN: one flat solid green #00B140 edge to edge. No gradient, no floor, no shadow, no
     green anywhere on the subject.
   - Images marked MAGENTA: one flat solid magenta #FF00FF edge to edge, nothing pink or magenta on the subject.
   - Images marked FULL: a complete picture that fills the frame to every edge (no cut-out).
   - Never fake transparency and never draw a checkerboard.

5. Pairs must line up exactly. For chhad/rooftop-lit, give the model the finished chhad/rooftop image and ask
   only for the edit in that prompt. The wall, the ledge and the framing must not move.
   Do the same for the optional chhad/rooftop-tall-lit with chhad/rooftop-tall.

6. The 7 ghosts: generate ghost-01 first. If it looks right, use ghost-01 as the style reference for ghosts
   02 to 07: "Same art style, palette, line work and finish as the reference image. A different ghost:" + that
   ghost's prompt + the ghost style block.

7. Look at every image before moving on, and regenerate it if:
   - there is any text, letters, a logo or a watermark
   - a GREEN or MAGENTA image has a shadow, a floor, a gradient, or that colour on the subject
   - something important is cut off at the edge
   - a ghost has blood, a wound or gore, or looks cute instead of eerie
   - the rooftop ledge is not straight and level, or the ledge has things standing on it

8. When everything is saved, run:  npm run art
   Then show me the list of files in art/raw/ (all folders) and the full output of npm run art.
```

---

## Step 2. Styles (the prompts say which one to add)

**Photo style**

> Photoreal, cinematic, premium festival photography, rich deep colours, crisp detail, shot on a full-frame camera,
> no text, no watermark, no logo, no border.

**Painted house style**

> Detailed digital painting, warm nostalgic storybook feel, like a frame from a Bengali animated film, rich
> textures, not cartoonish, no text, no watermark.

**Ghost style**

> Bengali folk-horror illustration, like a page from an old Thakurmar Jhuli storybook repainted as a moody digital
> painting: ink outlines, muted gouache texture, ash-grey and soot-black tones with only a few touches of faded white
> and dull red, and eyes that glow a pale amber. Eerie and a little frightening, but no blood, no wounds, no gore,
> nothing grotesque. One full-body figure, centred, filling about 80% of the height, nothing touching the edges.
> Plain flat chroma green background #00B140 from edge to edge, no ground, no shadow, no green anywhere on the figure
> (no leaves, no green cloth, no green glow). No text, no watermark. Square, 1024x1024.

---

## Prompts

### Opening: Kali Puja decoration beside Ma (Photo style)

These stand on both sides of Ma on the altar, so her left and right are never empty. Each is used twice, once
mirrored.

#### `intro/decor-lamp-tree.png` (GREEN, portrait 2:3, 1024x1536)
A traditional Bengali brass gachh-prodip (lamp tree): a tall polished brass standing lamp with five tiers of small
oil-lamp cups on gently curving branches, every wick burning with a small steady flame, on a round stepped brass
base. Front view, full height, centred, filling about 90% of the height. Plain flat chroma green background #00B140,
no floor, no shadow.

#### `intro/decor-drape.png` (GREEN, tall portrait 1:2, 1024x2048)
A heavy deep-red velvet temple curtain with a wide gold zari border, hanging in rich folds from the very top edge of
the picture to the bottom, gathered and tied back at about two thirds of its height with a thick gold rope and
tassel, so it curves like the left half of a theatre curtain. The curtain fills the left two thirds of the picture.
Plain flat chroma green background #00B140 everywhere else, no shadow.

#### `intro/decor-jaba-strands.png` (GREEN, tall portrait 1:3, 768x2304)
Five long strands of fresh red hibiscus (jaba) flowers threaded close together on red thread, hanging straight down
side by side from the top edge, each strand a different length, a few small orange marigolds between the hibiscus,
no leaves at all. Plain flat chroma green background #00B140, no shadow.

#### `intro/decor-ghot.png` (MAGENTA, square, 1024x1024)
A Bengali puja ghot: a round brass kalash with a red sindoor swastik painted on its belly, five fresh mango leaves
fanned in its mouth, a dry brown coconut wrapped in a red-bordered cloth on top, red and white threads tied around
its neck. Front view, centred. Plain flat magenta #FF00FF background, no shadow, nothing pink or magenta on the ghot.

#### `intro/decor-dhak.png` (GREEN, square, 1024x1024)
A Bengali dhak drum standing on its side, its wooden body tied with red and white cloth, a tall white plume of kash
flower feathers rising from its top. Front three-quarter view, centred. Plain flat chroma green background #00B140,
no floor, no shadow.

#### `intro/decor-chandmala.png` (GREEN, wide 3:1, 2304x768)
A wide hanging decoration of white shola (sola pith) chandmala, the traditional Bengali crescent-moon garlands, with
small gold zari accents and red jaba flowers at the joins, hanging in a gentle swag from the top-left corner to the
top-right corner of the picture. Front view. Plain flat chroma green background #00B140, no shadow.

### জবার মালা: the thala (Photo style)

The old picture showed its own edges on wide screens (the cloth and the lamp were cut). This one fills everything,
so any screen can crop it.

#### `mala/thala-scene.jpg` (FULL, square, 2048x2048)
Straight top-down view from directly above of a round polished brass (kansa) thala filled to the brim with clear
still water, nothing floating in it; the water catches soft warm reflections of a lamp so it clearly reads as water.
The thala sits exactly in the centre of the picture and is small in it: its outer rim is about 44% of the picture's
width. Under it, a white handloom gamchha with a red check border lies diagonally. A small lit clay prodip stands on
the cloth just outside the thala's rim at the upper left, completely inside the picture, its warm light falling
across the water. The whole rest of the frame, all the way to every edge, is an old dark stone floor with soft
texture, so the picture can be cropped on any side. Warm, low light, deep shadows towards the edges.

### ভূত চতুর্দশী

#### `bhoot/house-wide.jpg` (FULL, landscape 16:9, 2752x1536, Painted house style)
For computer screens (phones keep the tall house you already made). A cut-away cross-section of an old two-storey
North Kolkata house at night, like a dollhouse with the front wall removed, seen straight on, filling the whole frame
edge to edge. Upper floor, from left to right: a bedroom with a four-poster bed under a mosquito net and a wooden
almirah; a small thakur ghor with a shelf of framed pictures; a wooden staircase going down; a sitting room with a
cane chair and an old radio. Ground floor, from left to right: a kitchen with a clay oven and steel utensils on a
rack; the bottom of the staircase; an inner courtyard open to the night sky with a tulsi mancha, a well and a guava
tree; a dining space with a wooden table. On the roof above: a black water tank and a clothesline with saris. Every
room evenly and softly lit so all detail is visible (the site darkens it in code). Ceiling fans and old tube lights
on the walls, switched off. No people, no ghosts.

#### The 7 ghosts (GREEN, Ghost style)

One ghost guards two of the fourteen lamps. Save them as `bhoot/ghost-01.png` to `bhoot/ghost-07.png` in this order.

##### `bhoot/ghost-01.png` · শাঁকচুন্নি (Shakchunni) · on the roof, among the drying saris
The ghost of a married woman: tall and thin, ash-pale skin, a faded white sari with a dull red border pulled over her
head, white conch-shell bangles (shankha) on both wrists, long tangled black hair hiding half her face, one glowing
eye showing, reaching out with long fingers.

##### `bhoot/ghost-02.png` · পেত্নী (Petni) · the bedroom
A thin woman ghost crouching as if on top of a tall cupboard (draw no cupboard), wild black hair falling far below
her, a grey ragged sari, her feet turned backwards (the old sign of a petni), glowing eyes peering through the hair.

##### `bhoot/ghost-03.png` · নিশি (Nishi) · at the window and the stairs
The night caller who calls you by name in a loved one's voice: a tall, shadowy figure wrapped in a dark shawl, the
face lost in shadow except two faint glowing eyes, one long hand raised as if beckoning, a thin wisp of smoke at its
feet.

##### `bhoot/ghost-04.png` · চোরাচুন্নি (Chorachunni) · the sitting room
The ghost of a thief: a thin crouching figure with a dark gamchha tied over the head like a mask, creeping on
tiptoe, one long hand stretched forward to take something, a faint sly grin, glowing eyes, an old cloth bundle on its
back.

##### `bhoot/ghost-05.png` · মেছোভূত (Mechho Bhoot) · the kitchen
The fish-stealing ghost: a hunched, skinny, wet-looking grey figure with long dripping hair, holding a whole silver
fish by the tail, a sharp grin, glowing eyes.

##### `bhoot/ghost-06.png` · স্কন্ধকাটা (Skondhokata) · the stairs and the door
The headless ghost: a tall man's figure in a dark kurta and dhoti with no head, only dark smoke rising from the
shoulders, arms stretched forward, groping, walking stiffly, two faint glowing eyes on his chest as in the old
stories. No blood and no wound, only smoke where the head should be.

##### `bhoot/ghost-07.png` · গেছোভূত (Gechho Bhoot) · the courtyard, from the guava tree
The tree ghost: a long, lanky, stick-thin grey figure hanging upside down by its legs from a short bare brown branch
(no leaves at all), arms dangling, long hair hanging down, glowing eyes.

### ছাদের দীপাবলি: one full rooftop (Photo style)

The wall is now part of the same photo as the city, so it always matches. The ledge must stay empty: the site puts
the 14 prodips on it, the চোদ্দ প্রদীপ lit for the চোদ্দ পুরুষ.

#### `chhad/rooftop.jpg` (FULL, landscape 16:9, 2752x1536)
View from standing on an old North Kolkata rooftop at blue hour just after sunset on Diwali evening. In the
foreground an old lime-plastered brick parapet wall runs perfectly straight and level across the entire width of the
picture, edge to edge, seen straight on; its flat top ledge is at 64% of the picture's height from the top, and the
ledge is completely empty, nothing standing on it. Below the ledge, the weathered face of the wall with old paint and
a little dark moss fills the bottom of the picture. Beyond the wall: a dense sea of old Kolkata rooftops with black
water tanks, TV antennas, clotheslines, coconut palms and a temple spire, the Howrah Bridge small on the horizon just
right of centre, a few lit windows, no festival lights yet. Deep blue sky with a thin orange band at the horizon.
Keep the temple spire and the bridge within the middle third of the picture, because phones only show the middle.

#### `chhad/rooftop-lit.jpg` (FULL, edit of the picture above)
Edit this exact image. Change nothing in the foreground: the parapet wall and its ledge stay exactly as they are,
and the ledge stays empty. Only the city beyond changes: it is now Diwali night. Every distant rooftop is lined with
tiny oil lamps and candles, strings of warm fairy lights hang down the buildings, a few akash prodip lanterns glow
on bamboo poles, most windows glow warm, and the sky is a deeper night blue.

#### Optional, for phones: `chhad/rooftop-tall.jpg` and `chhad/rooftop-tall-lit.jpg` (FULL, portrait 9:16, 1536x2752)
The same two prompts, but portrait: the ledge at 70% of the picture's height from the top, the temple spire and the
Howrah Bridge both visible above the wall. Make `rooftop-tall-lit` as an edit of `rooftop-tall`, like the pair above.
If you skip these, phones use the wide pair.
