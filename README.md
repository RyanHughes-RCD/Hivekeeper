# Pixel Menagerie

A 16-bit style bug generator: creepy, arcane hive insects, spiders and other arthropods with too many eyes, spikes and tentacles, seen from above. Each bug is stitched together from up to eleven tiny sprites (head, eyes, jaws, antennae, thorax, abdomen, legs, spines, wings, tail, magic) into a single 64×64 sprite.

Open `index.html` in a browser. There is no build step and there are no image files: every part is a small grid of characters in the script.

## How the stitching works

1. **Parts.** Each part is written as a small sketch (1×2 eyes up to a 12×12 abdomen) and redrawn at double resolution when the page loads: solid areas with Scale2x, which rounds corners instead of making 2×2 blocks, and dark `k` lines as 1px lines through the doubled points, so legs and antennae get finer, not thicker. Anchors are doubled to match. Body parts are centred on the bug's spine; paired parts (eyes, antennae, legs, spines, wings) are drawn once as the left half and mirrored.
2. **Anchors.** The head sits on top of the thorax and the abdomen hangs below it. The thorax declares where legs and wings attach; the head declares where eyes and antennae go. Paired parts have an anchor pixel that lands on the attach point.
3. **Layering.** Parts are painted back to front: legs, antennae, side spines, abdomen, back ridge, tail, thorax, jaws, head, eyes, wings, magic. Wings sit on top of the body; only magic is drawn over them. Legs and antennae are 1px dark lines that are never outlined, so they stay thin.
4. **Shading.** Skin, accent and bone pixels are shaded per part, lit from the top left (light, mid and shadow tones from the palette).
5. **Seams.** Where a part overlaps an earlier one, a 1px outline is traced along the overlap so the pieces read separately.
6. **Light.** Magic parts (halo, sparkles, wisps, orbit, ethereal wings, sigils) use the palette's glow colour and are never outlined. Radiance adds a translucent ring of light just outside the outline.
7. **Outline and framing.** One outline is traced around the whole silhouette, then the bug is centred on a 64×64 canvas.

## Sprite characters

| Char | Meaning | Char | Meaning |
|---|---|---|---|
| `.` | empty | `w` | eye white |
| `b` | skin (auto-shaded) | `p` | pupil |
| `a` | accent (auto-shaded) | `g` | iris / glow |
| `h` | jaw or spike | `k` | thin dark line (legs, antennae) |
| `s` / `l` | forced skin shade / light | `e` | glowing red eye |
| `c` | clear wing (auto-shaded) | `y` | lantern glow (auto-shaded) |
| `m` | magic light (auto-shaded) | `n` | magic core (brightest) |

To add a part, append an entry to the matching list (`HEADS`, `EYES`, `JAWS`, `ANTENNAE`, `THORAXES`, `ABDOMENS`, `LEGS`, `SPINES`, `WINGS`, `TAILS`, `AURAS`) in `index.html`.

## Creature codes

Each bug has a 13-character code: one base-36 digit per slot, then the palette and markings. Open `index.html#CODE` to load one.

## Randomize odds

Randomize is stingy with extra parts. The odds live in `PAIR_ODDS` and `HAVE_ODDS` in `index.html`:

| Roll | Odds |
|---|---|
| Legs / wings | legs only 66%, wings only 24%, both 5%, neither 5% |
| Jaws / antennae | jaws only 45%, antennae only 45%, both 6%, neither 4% |
| Spines | 22% |
| Tail | 40% |
| Magic | 7% (Sigils markings 3%) |

Locked parts are respected: the pair outcome is re-rolled until it agrees with whatever is locked.
