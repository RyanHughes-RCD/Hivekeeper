// Little Bee Haven — top-down bee sprites assembled from body + legs + wings.
// The sprites are cut from the part sheets by tools/make-bee-sprites.py.
import { SPRITES } from './bee-sprites.js';
import { drawBee } from './art.js';

const WING_SPAN = 2.2;   // wing pair width, in body (abdomen) widths
const LEG_SPREAD = 1.35; // legs drawn larger than painted so they peek out past the body
const imgs = { bodies: {}, legs: [], wings: [] };
let ready = false;

function load(file) {
  // resolve next to this module so it works from any page (and any GitHub Pages sub-path)
  const src = new URL(`../assets/bees/${file}`, import.meta.url).href;
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

// Resolves once every part has loaded (or failed — the old drawn bees stand in then).
export const spritesReady = Promise.all([
  ...Object.keys(SPRITES.bodies).map(async (sp) => { imgs.bodies[sp] = await load(`body-${sp}.png`); }),
  ...SPRITES.legs.map(async (_, i) => { imgs.legs[i] = await load(`legs-${i}.png`); }),
  ...SPRITES.wings.map(async (_, i) => { imgs.wings[i] = await load(`wings-${i}.png`); }),
]).then(() => {
  ready = Object.values(imgs.bodies).every(Boolean) && imgs.legs.every(Boolean) && imgs.wings.every(Boolean);
  return ready;
});

export const beeSpritesLoaded = () => ready;

/**
 * Draw a bee seen from above, centred on (x, y), facing `angle` (0 = up the screen).
 * `size` is the width of the bee's body in pixels; wings and legs scale with it.
 * looks: { species, legs, wings }. opts: { angle, flap, walk, phase }.
 */
export function drawBeeTop(ctx, x, y, size, looks, t = 0, opts = {}) {
  const body = SPRITES.bodies[looks.species] || SPRITES.bodies.honey;
  const bodyImg = imgs.bodies[looks.species] || imgs.bodies.honey;
  if (!ready || !bodyImg) {
    // fallback while loading: the original side-view bee
    drawBee(ctx, x, y, size * 0.5, looks.species, t, { flip: Math.sin(opts.angle || 0) < 0, flap: opts.flap !== false, phase: opts.phase });
    return;
  }
  const k = size / body.abdomenW;
  const legs = SPRITES.legs[looks.legs] || SPRITES.legs[0];
  const legsImg = imgs.legs[looks.legs] || imgs.legs[0];
  const wings = SPRITES.wings[looks.wings] || SPRITES.wings[0];
  const wingsImg = imgs.wings[looks.wings] || imgs.wings[0];
  const ph = opts.phase || 0;

  ctx.save();
  ctx.translate(x, y);
  if (opts.angle) ctx.rotate(opts.angle);
  ctx.scale(k, k);
  // local space: the body's sprite pixels, centred on the body
  ctx.translate(-body.w / 2, -body.h / 2);
  const [nx, ny] = body.neck;
  const abd = body.abdomenW;

  // legs, tucked under the body; a little shuffle while walking
  const legsW = SPRITES.legsSpan * abd * LEG_SPREAD;
  const legsH = legsW * (legs.h / legs.w);
  const lx = nx + SPRITES.legsAnchor[0] * abd;
  const ly = ny + SPRITES.legsAnchor[1] * abd;
  ctx.save();
  ctx.translate(lx, ly);
  if (opts.walk) ctx.scale(1 + Math.sin(t * 14 + ph) * 0.05, 1 + Math.cos(t * 14 + ph) * 0.04);
  ctx.drawImage(legsImg, -legsW / 2, -legsH / 2, legsW, legsH);
  ctx.restore();

  ctx.drawImage(bodyImg, 0, 0, body.w, body.h);

  // wings, on the back, sweeping out from the thorax; they beat by narrowing
  const ww = WING_SPAN * abd;
  const wk = ww / wings.w;
  const wh = wings.h * wk;
  const beat = opts.flap ? 0.45 + 0.55 * Math.abs(Math.sin(t * 38 + ph)) : 0.92;
  ctx.save();
  ctx.translate(nx, ny + abd * 0.02);
  ctx.scale(beat, 1);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(wingsImg, -wings.anchor[0] * wk, -wings.anchor[1] * wk, ww, wh);
  ctx.restore();
  ctx.restore();
}

// Height of a drawn bee relative to its `size`, for laying out icons.
export function beeAspect(species) {
  const body = SPRITES.bodies[species] || SPRITES.bodies.honey;
  return body.h / body.abdomenW;
}
