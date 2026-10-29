# Antigravity sheet: the tall rooftop for phones

Phones are tall, so today they only see a soft middle slice of the wide rooftop photo (the temple spire falls off the
side). These two portrait pictures give phones their own rooftop. Computers keep the wide pair.

| File | What it is |
| --- | --- |
| `art/raw/chhad/rooftop-tall.jpg` | Dusk, before Diwali lights (FULL picture, portrait 9:16, 1536x2752) |
| `art/raw/chhad/rooftop-tall-lit.jpg` | The same picture on Diwali night (an edit of the first) |
| Optional: `art/raw/chhad/rooftop-lit.jpg` | A calmer redo of the wide Diwali-night picture |

---

## Step 1. Paste this into Antigravity

Open the folder `E:\WEBDEV PROJECTS\kali puja website` in Antigravity, choose an image model, and send:

```
You are generating two images for this website. Do not change any code and do not commit.

1. Read art/ANTIGRAVITY-ROOFTOP-TALL.md completely before you start.

2. Generate chhad/rooftop-tall first. Attach art/raw/chhad/rooftop.jpg as the reference image, so the wall, the
   city, the temple spire, the Howrah Bridge, the light and the colours match it. Use the prompt in the sheet
   exactly, with the Photo style block at the end.

3. Then generate chhad/rooftop-tall-lit as an EDIT of the finished chhad/rooftop-tall: attach that image and ask
   only for the edit in the sheet. The wall, the ledge and the framing must not move at all.

4. Save them exactly as:
   art/raw/chhad/rooftop-tall.jpg
   art/raw/chhad/rooftop-tall-lit.jpg
   Never rename, never add words to the names.

5. Look at both before you finish, and regenerate if:
   - the top of the wall is not perfectly straight and level from the left edge to the right edge
   - anything stands on the ledge (it must be completely empty)
   - the ledge is not at about 70% of the height from the top
   - the temple spire or the Howrah Bridge is missing or cut off
   - in the lit picture the wall moved, or the city turned into a blanket of glitter where the buildings
     disappear
   - there is any text, a logo or a watermark

6. Run:  npm run art -- rooftop-tall
   Then show me the list of files in art/raw/chhad/ and the full output of npm run art.
```

---

## Step 2. Photo style (add to the end of the first prompt)

> Photoreal, cinematic, premium festival photography, rich deep colours, crisp detail, shot on a full-frame camera,
> no text, no watermark, no logo, no border.

---

## Prompts

### `chhad/rooftop-tall.jpg` (FULL, portrait 9:16, 1536x2752)
The same place and moment as the reference image, recomposed as a tall portrait picture. Standing on an old North
Kolkata rooftop at blue hour just after sunset on Diwali evening. In the foreground the same old lime-plastered brick
parapet wall, with its yellow-green moss and peeling paint, runs perfectly straight and level across the entire width
of the picture, edge to edge, seen straight on. Its flat top ledge is at exactly 70% of the picture's height from the
top, and the ledge is completely empty, nothing standing on it. Below the ledge the weathered face of the wall fills
the bottom of the picture. Above the wall: a dense sea of old Kolkata rooftops with black water tanks, TV antennas,
clotheslines and coconut palms. The tall temple spire and the Howrah Bridge are both fully visible above the wall,
within the middle 80% of the width: the spire right of centre, the bridge small behind it on the horizon. A few lit
windows, no festival lights yet. A tall deep blue sky fills the top half, with a thin orange band at the horizon.

### `chhad/rooftop-tall-lit.jpg` (FULL, edit of the picture above)
Edit this exact image. Change nothing in the foreground: the parapet wall and its ledge stay exactly as they are, and
the ledge stays empty. Only the city beyond changes: it is now Diwali night. Rows of tiny warm oil lamps and candles
along the distant rooftops, a few strings of fairy lights down some buildings, two or three akash prodip lanterns on
bamboo poles, and many windows glowing warm. Keep the lights small and spread out so every building, the temple spire
and the Howrah Bridge stay clearly visible: a lit city, not a blanket of glitter. The sky becomes a deeper night blue,
still dark enough for fireworks.

---

## Optional: a calmer wide Diwali-night picture

The current `chhad/rooftop-lit.jpg` turned the whole city into a sheet of gold sparkles, which hides the buildings and
competes with the fireworks. If you want the finale on computers to look as good as on phones, also ask Antigravity:

```
Attach art/raw/chhad/rooftop.jpg and edit it with this prompt, then save it as art/raw/chhad/rooftop-lit.jpg
(replacing the old one) and run:  npm run art -- rooftop-lit
```

Prompt for that edit: the `rooftop-tall-lit` prompt above, word for word.
