"""Builds js/map.js from the garden map image.

Finds the isometric checkerboard in the picture (tile width/height and where a
tile centre sits), then marks every tile as land (buildable grass) or not
(river, waterfall, cliffs, image edges). Run it again after replacing
assets/garden-map.jpg:

    python3 tools/make-map.py [assets/garden-map.jpg]
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
keep_grid = '--keep-grid' in sys.argv
src = Path(args[0]) if args else ROOT / 'assets' / 'garden-map.jpg'
img = Image.open(src).convert('RGB')
IW, IH = img.size
px = np.asarray(img).astype(float)
R, G, Bc = px[:, :, 0], px[:, :, 1], px[:, :, 2]
grass = (G > R + 12) & (G > Bc + 50)

if keep_grid:
    old = json.loads(re.search(r'MAP = (\{.*\});', (ROOT / 'js' / 'map.js').read_text()).group(1))
    W, H = old['tileW'] * IW, old['tileH'] * IH
    ox, oy = old['originX'] * IW, old['originY'] * IH
    print(f'image {IW}x{IH}  keeping grid: tile {W:.3f} x {H:.3f}, tile 0,0 at ({ox:.1f}, {oy:.1f})')
else:
    # ---- 1. fit the checkerboard: shade ~ cos(2*pi*x/W - p1) + cos(2*pi*y/H - p2)
    shade = G - R
    ys, xs = np.nonzero(grass)
    pick = np.random.default_rng(1).choice(len(xs), min(20000, len(xs)), replace=False)
    xs, ys = xs[pick].astype(float), ys[pick].astype(float)
    val = shade[ys.astype(int), xs.astype(int)]
    val -= val.mean()


    def score(W, H):
        return abs(np.mean(val * np.exp(2j * np.pi * xs / W))) + abs(np.mean(val * np.exp(2j * np.pi * ys / H)))


    # the two axes are independent, so fit each on its own, coarse then fine
    def fit(lo, hi, axis):
        best = None
        for step in (0.5, 0.05, 0.005):
            for v in np.arange(lo, hi, step):
                c = xs if axis == 0 else ys
                a = abs(np.mean(val * np.exp(2j * np.pi * c / v)))
                if best is None or a > best[0]:
                    best = (a, v)
            lo, hi = best[1] - step * 2, best[1] + step * 2
        return best[1]


    scale = IW / 1788.0  # search ranges were tuned on the 1788px original
    W = fit(60 * scale, 100 * scale, 0)
    H = fit(28 * scale, 46 * scale, 1)
    p1 = np.angle(np.mean(val * np.exp(2j * np.pi * xs / W)))
    p2 = np.angle(np.mean(val * np.exp(2j * np.pi * ys / H)))
    x0 = (W * p1 / (2 * np.pi)) % W
    y0 = (H * p2 / (2 * np.pi)) % H


    # The phase gives a point on the lattice, but not necessarily a diamond centre.
    # Try the candidate offsets and keep the one whose diamonds are flattest inside.
    def flatness(cx0, cy0):
        errs = []
        for i in range(0, 46, 3):
            for j in range(0, 32, 3):
                if (i + j) % 2:
                    continue
                cx, cy = cx0 + i * W / 2, cy0 + j * H / 2
                if not (W < cx < IW - W and H < cy < IH - H):
                    continue
                pts = [(cx + u * W / 2, cy + v * H / 2) for u, v in
                       ((0, 0), (-0.8, 0), (0.8, 0), (0, -0.8), (0, 0.8), (-0.4, -0.4), (0.4, 0.4), (-0.4, 0.4), (0.4, -0.4))]
                if not all(grass[int(y), int(x)] for x, y in pts):
                    continue
                v = [shade[int(y), int(x)] for x, y in pts]
                errs.append(np.std(v))
        return np.mean(errs)


    cands = [(dx, dy) for dx in np.arange(0, W, 1.0) for dy in np.arange(0, H, 1.0)]
    x0, y0 = min(cands, key=lambda c: flatness(*c))
    print(f'image {IW}x{IH}  tile {W:.3f} x {H:.3f}  a tile centre at ({x0:.1f}, {y0:.1f})')

    # ---- 2. choose tile (0,0): keep the original 7x7 garden (and the cottage behind
    # it) inside the big left-hand meadow so existing saves keep working.
    want_x, want_y = 0.165 * IW, 0.40 * IH
    # tile centres are at (x0 + i*W/2, y0 + j*H/2) with i + j even
    i = round((want_x - x0) / (W / 2))
    j = round((want_y - y0) / (H / 2))
    if (i + j) % 2:
        j += 1
    ox, oy = x0 + i * W / 2, y0 + j * H / 2



def centre(tx, ty):
    return ox + (tx - ty) * W / 2, oy + (tx + ty) * H / 2


# ---- 3. classify each tile by sampling points inside its diamond
samples = [(0, 0)] + [(u * 0.32, v * 0.32) for u in (-1, 1) for v in (-1, 1)] + \
          [(u * 0.62, 0) for u in (-1, 1)] + [(0, v * 0.62) for v in (-1, 1)]
land = []
for tx in range(-40, 60):
    for ty in range(-40, 60):
        cx, cy = centre(tx, ty)
        # whole diamond must be inside the picture
        if cx - W / 2 < 2 or cx + W / 2 > IW - 2 or cy - H / 2 < 2 or cy + H / 2 > IH - 2:
            continue
        ok = 0
        for u, v in samples:
            sx, sy = int(cx + u * W / 2), int(cy + v * H / 2)
            win = grass[max(0, sy - 2):sy + 3, max(0, sx - 2):sx + 3]
            ok += win.mean() > 0.6
        # allow one sample to miss (tiny painted flowers and grass tufts), but never the centre
        cx_i, cy_i = int(cx), int(cy)
        if ok >= len(samples) - 1 and grass[cy_i - 2:cy_i + 3, cx_i - 2:cx_i + 3].mean() > 0.6:
            land.append([tx, ty])

print(f'{len(land)} land tiles')
out = {
    'src': 'assets/garden-map.jpg',
    # everything is stored as fractions of the image size so a higher
    # resolution export of the same picture drops straight in
    'tileW': W / IW, 'tileH': H / IH,
    'originX': ox / IW, 'originY': oy / IH,
    'aspect': IW / IH,
    'land': land,
}
js = ('// Generated by tools/make-map.py from assets/garden-map.jpg — do not edit by hand.\n'
      '// Tile geometry is in fractions of the image size; land lists buildable grass tiles.\n'
      f'export const MAP = {json.dumps(out, separators=(",", ":"))};\n')
(ROOT / 'js' / 'map.js').write_text(js)
print('wrote js/map.js')
