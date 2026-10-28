# ভূত চতুর্দশী: the 14 ghosts

Fourteen Bengali folk ghosts, one beside each of the fourteen lamps in the house. Light a lamp and its ghost leaves.
They replace the six white sheet ghosts. A little scary, the kind a grandmother describes at night, never gory.

The site needs each ghost as its **own image** (not a sheet), named `ghost-01` to `ghost-14` in this order, because
the order matches the lamps (ghost-01 waits by lamp 1 on the roof, ghost-14 by the well in the courtyard).

---

## Paste this into Antigravity

Open the folder `E:\WEBDEV PROJECTS\kali puja website` in Antigravity and send:

```
You are generating 14 ghost images for this website. Do not change any code and do not commit.

1. Read art/GHOSTS.md completely before you start.

2. Generate ghost-01 first, using its prompt plus the "Shared style" block at the end.
   Look at it: if the style is right (dark Bengali folk-horror storybook painting, glowing amber eyes,
   flat #00B140 green background), use ghost-01 as the style reference image for every other ghost:
   "Same art style, palette, line work and finish as the reference image. A different ghost:" + that ghost's prompt
   + the Shared style block.

3. Save each one as art/raw/bhoot/ghost-01.png, ghost-02.png ... ghost-14.png. Exactly these names, two-digit
   numbers, in the order of the file. One ghost per image.

4. Check every image before moving on and regenerate it if:
   - there is blood, a wound, gore or anything grotesque
   - there is any text, letters or a watermark
   - there is green anywhere on the ghost (leaves, green cloth, green glow)
   - the background is not one flat #00B140 green, or there is a floor or a shadow
   - the ghost touches the edge of the picture, or there is more than one figure
   - it looks cute or comic instead of eerie

5. When all 14 are saved, run:  npm run art -- ghost
   It cuts out the green and writes public/assets/bhoot/ghost-1.webp ... ghost-14.webp.

6. Show me the list of files in art/raw/bhoot/ and the full output of npm run art.
```

---

## Shared style (add to the end of every prompt)

> Style: Bengali folk-horror illustration, like a page from an old Thakurmar Jhuli storybook repainted as a moody
> digital painting: ink outlines, muted gouache texture, ash-grey and soot-black tones with only a few touches of
> faded white and dull red, and eyes that glow a pale amber. Eerie and a little frightening, but no blood, no
> wounds, no gore, nothing grotesque. One full-body figure, centred, filling about 80% of the height, nothing
> touching the edges. Plain flat chroma green background #00B140 from edge to edge, no ground, no shadow, no green
> anywhere on the figure (no leaves, no green cloth, no green glow). No text, no watermark. Square, 1024x1024.

---

## The 14 ghosts

### ghost-01 · পেঁচাপেঁচি (Penchapechi) · on the roof, by the potted plant
An owl-like ghost from the forest stories: a hunched figure with a large round owl face, huge glowing amber eyes,
ragged soot-grey feathers that turn into smoke at the edges, and long thin clawed fingers, crouched as if perched on
a wall (draw no wall).

### ghost-02 · শাঁকচুন্নি (Shakchunni) · on the roof, among the drying saris
The ghost of a married woman: tall and thin, ash-pale skin, a faded white sari with a dull red border pulled over her
head, white conch-shell bangles (shankha) on both wrists, long tangled black hair hiding half her face, one glowing
eye showing, reaching out with long fingers.

### ghost-03 · পেত্নী (Petni) · top floor, on top of the almirah
A thin woman ghost crouching as if on top of a tall cupboard (draw no cupboard), wild black hair falling far below
her, a grey ragged sari, her feet turned backwards (the old sign of a petni), glowing eyes peering through the hair.

### ghost-04 · বোবা (Boba) · top floor, on the bed
The mute ghost who sits on a sleeper's chest: a squat, heavy, dark-grey figure with no mouth, crouched low with
knees up and both hands pressing down, two glowing eyes in a blank face.

### ghost-05 · নিশি (Nishi) · top floor, outside the window
The night caller who calls you by name in a loved one's voice: a tall, shadowy figure wrapped in a dark shawl, the
face lost in shadow except two faint glowing eyes, one long hand raised as if beckoning, a thin wisp of smoke at its
feet.

### ghost-06 · ব্রহ্মদৈত্য (Brahmadaitya) · middle floor, beside the thakur ghor
The ghost of an old Brahmin, stern and dignified, not comic: tall and gaunt, ash-grey skin, a white dhoti, a sacred
thread (poita) across the bare chest, a topknot, wooden khadam sandals, a long rosary in one hand, a cold glowing
gaze.

### ghost-07 · চোরাচুন্নি (Chorachunni) · middle floor, near the radio
The ghost of a thief: a thin crouching figure with a dark gamchha tied over the head like a mask, creeping on
tiptoe, one long hand stretched forward to take something, a faint sly grin, glowing eyes, an old cloth bundle on its
back.

### ghost-08 · কানাভুলো (Kanabhulo) · middle floor, on the stairs
The ghost that leads people the wrong way at night: a crooked, hooded grey figure holding up a small dim lantern with
a warm light, beckoning with the other hand, a sly glowing glance over its shoulder.

### ghost-09 · মেছোভূত (Mechho Bhoot) · ground floor, in the kitchen
The fish-stealing ghost: a hunched, skinny, wet-looking grey figure with long dripping hair, holding a whole silver
fish by the tail, a sharp grin, glowing eyes.

### ghost-10 · যখ (Jokkho) · ground floor, under the dining table
The guardian of treasure hidden in old houses: a small, ancient, wrinkled spirit sitting cross-legged on an old brass
pot full of gold coins, very long nails, deep glowing eyes, dust and cobwebs clinging to it.

### ghost-11 · স্কন্ধকাটা (Skondhokata) · ground floor, on the stairs
The headless ghost: a tall man's figure in a dark kurta and dhoti with no head, only dark smoke rising from the
shoulders, arms stretched forward, groping, walking stiffly, two faint glowing eyes on his chest as in the old
stories. No blood and no wound, only smoke where the head should be.

### ghost-12 · গেছোভূত (Gechho Bhoot) · courtyard, hanging from the guava tree
The tree ghost: a long, lanky, stick-thin grey figure hanging upside down by its legs from a short bare brown branch
(no leaves at all), arms dangling, long hair hanging down, glowing eyes.

### ghost-13 · একানড়ে (Ekanore) · courtyard, at the door
The one-legged ghost of the palm trees: very tall and thin, standing on one long leg with the other folded up, long
arms, a narrow head with glowing eyes, ragged dark cloth hanging off it.

### ghost-14 · দেও (Deo) · courtyard, by the well
The water ghost that lives in ponds and wells: a dark, slick grey figure rising with water streaming off it (the
water drawn as grey-white streaks, no green), long wet hair over the face, one hand reaching up, glowing eyes.
