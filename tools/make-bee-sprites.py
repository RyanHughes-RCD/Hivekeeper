"""Cuts the bee part sheets into transparent sprites and records how they fit together.

    python3 tools/make-bee-sprites.py

Reads  assets/bees/source/bodies.jpg  4x3 grid, white background, species in SPECIES order
       assets/bees/source/legs.jpg    4x3 grid, white background, laid out to match the bodies
       assets/bees/source/wings.jpg   3x2 grid, painted grey checkerboard background
Writes assets/bees/body-<species>.png, legs-<n>.png, wings-<n>.png and js/bee-sprites.js
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'bees' / 'source'
OUT = ROOT / 'assets' / 'bees'
SPECIES = ['honey', 'bumble', 'clover', 'sleepy', 'mint', 'lavender', 'peach', 'rose', 'sky', 'moon', 'rainbow', 'queen']
BODY_H = 256      # output height of a body sprite (px)
WING_SCALE = 0.6  # wings are drawn about twice a body's width, so they don't need full size


def flood_background(rgb, is_bg):
    """Pixels connected to the image border through `is_bg` pixels."""
    h, w = is_bg.shape
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and is_bg[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def matte(rgb, bg, outside, soft=70.0, floor=14.0):
    """Turn a picture over a known background into RGBA.

    Inside the subject (not reachable from the border) stays opaque. Outside it,
    alpha comes from how far a pixel is from the background colour, which keeps
    anti-aliased edges and soft glows instead of hard cut-outs.
    """
    diff = np.abs(rgb - bg).max(axis=2)
    # `floor` swallows JPEG speckle in the background so it ends up fully clear
    alpha = np.where(outside, np.clip((diff - floor) / soft, 0, 1), 1.0)
    a = np.maximum(alpha, 1e-3)[..., None]
    # un-mix the background out of semi-transparent pixels
    colour = np.clip((rgb - bg * (1 - a)) / a, 0, 255)
    return np.dstack([colour, alpha * 255]).astype(np.uint8)


def cells(img, cols, rows):
    w, h = img.size
    cw, ch = w / cols, h / rows
    for r in range(rows):
        for c in range(cols):
            box = (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))
            yield r * cols + c, box


def bbox(alpha, thresh=40):
    ys, xs = np.nonzero(alpha > thresh)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


# ---------------------------------------------------------------- bodies
bodies_img = Image.open(SRC / 'bodies.jpg').convert('RGB')
body_meta = {}
body_scale = None
for i, box in cells(bodies_img, 4, 3):
    rgb = np.asarray(bodies_img.crop(box)).astype(float)
    near_white = (rgb.min(axis=2) > 225) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 18)
    outside = flood_background(rgb, near_white | (np.abs(rgb - 255).max(axis=2) < 70))
    rgba = matte(rgb, np.full(3, 255.0), outside)
    x0, y0, x1, y1 = bbox(rgba[:, :, 3])
    solid = rgba[:, :, 3] > 200
    # width of the body on each row; the neck is the narrowest row between head and abdomen
    widths = solid[y0:y1, x0:x1].sum(axis=1)
    hgt = y1 - y0
    lo, hi = int(hgt * 0.3), int(hgt * 0.7)
    band = widths[lo:hi]
    # skip rows of thin antennae/hats: only consider rows at least 40% of the widest row
    widest = widths.max()
    cand = [k for k in range(len(band)) if band[k] > widest * 0.4]
    neck_row = lo + min(cand, key=lambda k: band[k])
    abdomen = widths[neck_row:]
    abd_w = abdomen.max()
    abd_rows = np.nonzero(solid[y0 + neck_row:y1, x0:x1].any(axis=0))[0]
    cx = (abd_rows.min() + abd_rows.max() + 1) / 2
    body_meta[SPECIES[i]] = {
        'box': [int(box[0] + x0), int(box[1] + y0)], 'w': int(x1 - x0), 'h': int(hgt),
        'neck': [float(cx), float(neck_row)], 'abdomenW': float(abd_w),
        'sprite': Image.fromarray(rgba[y0:y1, x0:x1]),
    }
# one scale for every body so their relative sizes stay as painted
tallest = max(m['h'] for m in body_meta.values())
body_scale = BODY_H / tallest

# ---------------------------------------------------------------- legs
legs_img = Image.open(SRC / 'legs.jpg').convert('RGB')
legs_meta = []
for i, box in cells(legs_img, 4, 3):
    rgb = np.asarray(legs_img.crop(box)).astype(float)
    outside = np.ones(rgb.shape[:2], bool)  # legs have no white inside: matte everything
    rgba = matte(rgb, np.full(3, 255.0), outside, soft=60.0, floor=18.0)
    x0, y0, x1, y1 = bbox(rgba[:, :, 3])
    legs_meta.append({
        'box': [int(box[0] + x0), int(box[1] + y0)], 'w': int(x1 - x0), 'h': int(y1 - y0),
        'sprite': Image.fromarray(rgba[y0:y1, x0:x1]),
    })

# The legs sheet is laid out to sit under the bodies sheet, so cell 0 of each
# shows where legs belong relative to a body's neck. Store that as the anchor.
ref_body = body_meta[SPECIES[0]]
ref_legs = legs_meta[0]
neck_x = ref_body['box'][0] + ref_body['neck'][0]
neck_y = ref_body['box'][1] + ref_body['neck'][1]
legs_dx = (ref_legs['box'][0] + ref_legs['w'] / 2 - neck_x) / ref_body['abdomenW']
legs_dy = (ref_legs['box'][1] + ref_legs['h'] / 2 - neck_y) / ref_body['abdomenW']
legs_span = ref_legs['w'] / ref_body['abdomenW']

# ---------------------------------------------------------------- wings
wings_img = Image.open(SRC / 'wings.jpg').convert('RGB')
wrgb_full = np.asarray(wings_img).astype(float)
# The wings are painted see-through over a grey checkerboard (light 201 / dark 166
# squares), so the board shows through the membranes. Because the board is known
# exactly, how strongly it shows through at each spot tells us the transparency
# there, and the true colour can be recovered by subtracting it back out.
LIGHT, DARK = 201.0, 166.0
MID, HALF = (LIGHT + DARK) / 2, (LIGHT - DARK) / 2
H_, W_ = wrgb_full.shape[:2]
vals = wrgb_full.mean(axis=2)
greyish = (np.abs(wrgb_full[:, :, 0] - wrgb_full[:, :, 2]) < 6)
# fit square size and offset on the bare margins of the sheet
mask = greyish & ((np.abs(vals - LIGHT) < 10) | (np.abs(vals - DARK) < 10))
ys, xs = np.nonzero(mask)
sel = np.random.default_rng(2).choice(len(xs), min(30000, len(xs)), replace=False)
xs, ys, lit = xs[sel], ys[sel], (np.abs(vals[ys[sel], xs[sel]] - LIGHT) < 10)
best = None
for size in np.arange(21.0, 26.0, 0.05):
    for ox in np.arange(0, size, 1.0):
        for oy in np.arange(0, size, 1.0):
            par = ((np.floor((xs + ox) / size) + np.floor((ys + oy) / size)) % 2) == 0
            score = np.mean(par == lit)
            if best is None or score > best[0]:
                best = (score, size, ox, oy)
score, size, ox, oy = best
yy, xx = np.mgrid[0:H_, 0:W_]
sign = np.where(((np.floor((xx + ox) / size) + np.floor((yy + oy) / size)) % 2) == 0, 1.0, -1.0)
print(f'checkerboard: {size:.2f}px squares, offset ({ox:.0f}, {oy:.0f}), fit {score:.3f}')


def box_blur(a, r):
    """Mean over a (2r+1)^2 window, via summed-area tables."""
    p = np.pad(a, r + 1, mode='edge')
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    out = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return out[:a.shape[0], :a.shape[1]] / (k * k)


# how much of the board shows through = local correlation with the square pattern
win = int(round(size))  # window spans two squares each way, so the pattern averages out
show = np.clip(box_blur(vals * sign, win) / HALF, 0, 1)
# the outline and fully painted areas cover the board completely
bg_full = (MID + HALF * sign)[..., None] * np.ones(3)



def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:, :] |= out[:-1, :]; m[:-1, :] |= out[1:, :]
        m[:, 1:] |= out[:, :-1]; m[:, :-1] |= out[:, 1:]
        out = m
    return out


def components(mask):
    """8-connected blobs of a boolean mask -> list of (ys, xs) arrays."""
    h, w = mask.shape
    label = np.zeros((h, w), np.int32)
    blobs = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if label[y0, x0]:
            continue
        n = len(blobs) + 1
        label[y0, x0] = n
        q = deque([(y0, x0)])
        ys, xs = [], []
        while q:
            y, x = q.popleft()
            ys.append(y); xs.append(x)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not label[ny, nx]:
                        label[ny, nx] = n
                        q.append((ny, nx))
        blobs.append((np.array(ys), np.array(xs)))
    return blobs


# Whole sheet at once: wings can stray across the 3x2 grid lines.
rgb = wrgb_full
bg = bg_full
# the outline (thickened a little so hairline gaps don't let the fill leak in)
outline = dilate(rgb.mean(axis=2) < 140, 2)
outside = flood_background(rgb, ~outline)
diff = np.abs(rgb - bg).max(axis=2)
alpha_out = np.clip((diff - 26) / 45, 0, 1)          # background + glow, square by square
alpha_in = np.maximum(1 - show, 0.35)                 # membranes: how much board shows through
alpha = np.where(outside, alpha_out, alpha_in)
a3 = np.maximum(alpha, 0.05)[..., None]
colour = np.clip((rgb - (1 - a3) * bg) / a3, 0, 255)
alpha = np.where(alpha < 0.08, 0, alpha)
sheet = np.dstack([colour, alpha * 255]).astype(np.uint8)

# group the blobs into the six pairs by which grid cell their middle falls in
cw, ch = W_ / 3, H_ / 2
groups = {k: [] for k in range(6)}
for ys, xs in components(alpha > 0.3):
    if len(ys) < 400:  # specks
        continue
    k = int(min(1, ys.mean() // ch) * 3 + min(2, xs.mean() // cw))
    groups[k].append((ys, xs))

wings_meta = []
for k in range(6):
    ys = np.concatenate([g[0] for g in groups[k]])
    xs = np.concatenate([g[1] for g in groups[k]])
    keep = np.zeros(alpha.shape, bool)
    keep[ys, xs] = True
    keep = dilate(keep, 14)   # bring back soft edges and the glow around each blob
    x0, y0, x1, y1 = xs.min() - 14, ys.min() - 14, xs.max() + 15, ys.max() + 15
    x0, y0 = max(0, x0), max(0, y0)
    crop = sheet[y0:y1, x0:x1].copy()
    crop[:, :, 3] = np.where(keep[y0:y1, x0:x1], crop[:, :, 3], 0)
    sprite = Image.fromarray(crop)
    # painted with the wings meeting at the bottom; flip so they sweep back over the body
    sprite = sprite.transpose(Image.FLIP_TOP_BOTTOM)
    a = np.asarray(sprite)[:, :, 3]
    # where the two wings meet: after the flip, the top of the middle columns
    mid = a.shape[1] // 2
    col = a[:, mid - 6:mid + 6].max(axis=1)
    top = int(np.argmax(col > 120))
    wings_meta.append({'w': sprite.width, 'h': sprite.height, 'anchor': [float(a.shape[1] / 2), float(top)], 'sprite': sprite})

# ---------------------------------------------------------------- save
def save(img, name, scale):
    w, h = img.size
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    img.save(OUT / name, optimize=True)
    return img.size


meta = {'scale': body_scale, 'bodies': {}, 'legs': [], 'wings': [],
        'legsAnchor': [legs_dx, legs_dy], 'legsSpan': legs_span}
for sp, m in body_meta.items():
    size = save(m['sprite'], f'body-{sp}.png', body_scale)
    meta['bodies'][sp] = {'w': size[0], 'h': size[1], 'neck': [m['neck'][0] * body_scale, m['neck'][1] * body_scale],
                          'abdomenW': m['abdomenW'] * body_scale}
for i, m in enumerate(legs_meta):
    size = save(m['sprite'], f'legs-{i}.png', body_scale)
    meta['legs'].append({'w': size[0], 'h': size[1]})
for i, m in enumerate(wings_meta):
    k = body_scale * WING_SCALE
    size = save(m['sprite'], f'wings-{i}.png', k)
    meta['wings'].append({'w': size[0], 'h': size[1], 'anchor': [m['anchor'][0] * k, m['anchor'][1] * k]})

js = ('// Generated by tools/make-bee-sprites.py — do not edit by hand.\n'
      '// Sprite sizes and attachment points (px in the saved PNGs).\n'
      f'export const SPRITES = {json.dumps(meta, indent=1)};\n')
(ROOT / 'js' / 'bee-sprites.js').write_text(js)
print(f'bodies x{len(body_meta)}, legs x{len(legs_meta)}, wings x{len(wings_meta)}; scale {body_scale:.3f}')
print('legs anchor', legs_dx, legs_dy, 'span', legs_span)
