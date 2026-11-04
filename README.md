# Pixel Menagerie

A 16-bit style creature generator. Each creature is stitched together from up to nine tiny sprites (body, head, eyes, mouth, ears or horns, arms, legs, tail, wings) into a single 32×32 sprite.

Open `index.html` in a browser. There is no build step and there are no image files: every part is a small grid of characters in the script.

## How the stitching works

1. **Parts.** Each part is a small sprite, usually 2×2 to 14×10 pixels. Paired parts (eyes, ears, arms, legs, wings) are drawn once as the left side and mirrored.
2. **Anchors.** Bodies declare where arms, legs, a tail and wings attach. Heads declare where eyes, the mouth and ears go. Each part has an anchor pixel that lands on its attach point.
3. **Layering.** Parts are painted back to front: wings, tail, ears, legs, body, arms, head, eyes, mouth.
4. **Shading.** Skin, accent and bone pixels are shaded per part, lit from the top left (light, mid and shadow tones from the palette).
5. **Seams.** Where a part overlaps an earlier one, a 1px outline is traced along the overlap so the pieces read separately.
6. **Outline and framing.** One outline is traced around the whole silhouette, then the creature is centred on a 32×32 canvas with its feet on row 30.

## Sprite characters

| Char | Meaning | Char | Meaning |
|---|---|---|---|
| `.` | empty | `w` | eye white |
| `b` | skin (auto-shaded) | `p` | pupil |
| `a` | accent (auto-shaded) | `g` | iris / glow |
| `h` | bone or horn | `k` | mouth dark |
| `s` / `l` | forced skin shade / light | `t` / `r` | tooth / tongue |

To add a part, append an entry to the matching list (`BODIES`, `HEADS`, `EYES`, `MOUTHS`, `EARS`, `ARMS`, `LEGS`, `TAILS`, `WINGS`) in `index.html`.

## Creature codes

Each creature has an 11-character code: one base-36 digit per slot, then the palette and markings. Open `index.html#CODE` to load one.
