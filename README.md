# Pixel Menagerie

A 16-bit style bug generator: cute, creepy little insects, spiders and other arthropods seen from above. Each bug is stitched together from up to nine tiny sprites (head, eyes, jaws, antennae, thorax, abdomen, legs, wings, tail) into a single 32×32 sprite.

Open `index.html` in a browser. There is no build step and there are no image files: every part is a small grid of characters in the script.

## How the stitching works

1. **Parts.** Each part is a small sprite, from 1×2 eyes up to a 12×12 abdomen. Body parts are centred on the bug's spine; paired parts (eyes, antennae, legs, wings) are drawn once as the left half and mirrored.
2. **Anchors.** The head sits on top of the thorax and the abdomen hangs below it. The thorax declares where legs and wings attach; the head declares where eyes and antennae go. Paired parts have an anchor pixel that lands on the attach point.
3. **Layering.** Parts are painted back to front: legs, antennae, wings, abdomen, tail, thorax, jaws, head, eyes. Legs and antennae are 1px dark lines that are never outlined, so they stay thin.
4. **Shading.** Skin, accent and bone pixels are shaded per part, lit from the top left (light, mid and shadow tones from the palette).
5. **Seams.** Where a part overlaps an earlier one, a 1px outline is traced along the overlap so the pieces read separately.
6. **Outline and framing.** One outline is traced around the whole silhouette, then the bug is centred on a 32×32 canvas. A second frame makes the legs scuttle and the wings flutter.

## Sprite characters

| Char | Meaning | Char | Meaning |
|---|---|---|---|
| `.` | empty | `w` | eye white |
| `b` | skin (auto-shaded) | `p` | pupil |
| `a` | accent (auto-shaded) | `g` | iris / glow |
| `h` | jaw or spike | `k` | thin dark line (legs, antennae) |
| `s` / `l` | forced skin shade / light | `e` | glowing red eye |
| `c` | clear wing (auto-shaded) | `y` | lantern glow (auto-shaded) |

To add a part, append an entry to the matching list (`HEADS`, `EYES`, `JAWS`, `ANTENNAE`, `THORAXES`, `ABDOMENS`, `LEGS`, `WINGS`, `TAILS`) in `index.html`.

## Creature codes

Each bug has an 11-character code: one base-36 digit per slot, then the palette and markings. Open `index.html#CODE` to load one.
