// Little Bee Haven — renders game art into small cached images for the HTML UI.
import { drawFlowerTile, drawDecor, drawEgg, drawSeedPacket, drawHoneyDrop, ellipse, drawGift } from './art.js';
import { drawBeeTop, beeSpritesLoaded, beeAspect } from './beeart.js';

const cache = new Map();
const DPR = Math.min(3, window.devicePixelRatio || 1);

function render(key, w, h, fn, cacheable = true) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
  const ctx = c.getContext('2d');
  ctx.scale(DPR, DPR);
  fn(ctx, w, h);
  const url = c.toDataURL('image/png');
  if (cacheable) cache.set(key, url);
  return url;
}

// A bee from above, fitted into a square icon. Bees aren't cached until their
// sprites have loaded, so an early icon gets redrawn properly next time.
function beeImage(key, looks, silhouette) {
  return render(key, 96, 96, (ctx) => {
    const size = Math.min(44, 78 / beeAspect(looks.species));
    drawBeeTop(ctx, 48, 48, size, looks, 0.4, {});
    if (silhouette) {
      // undiscovered: a soft sandy shape with a question mark
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#cdb89a';
      ctx.fillRect(0, 0, 96, 96);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#9c8466';
      ctx.font = '800 30px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 48, 52);
    }
  }, beeSpritesLoaded());
}

// the species as a whole (collection grid): its body with plain legs and wings
export const beeIcon = (species, silhouette = false) => beeImage(`bee:${species}:${silhouette}`, { species, legs: 0, wings: 0 }, silhouette);

// one particular bee, with its own legs and wings
export const beeIconFor = (bee) => beeImage(`bee:${bee.species}:${bee.legs}:${bee.wings}`, bee, false);

export const flowerIcon = (type) => render(`flower:${type}`, 64, 64, (ctx) => {
  ctx.translate(32, 44);
  ctx.scale(1.25, 1.25);
  drawFlowerTile(ctx, 0, 0, type, 3, 0, false, 3);
});

export const seedIcon = (type) => render(`seed:${type}`, 64, 64, (ctx) => drawSeedPacket(ctx, 32, 32, 20, type));

export const decorIcon = (type) => render(`decor:${type}`, 64, 64, (ctx) => {
  const tall = { tree: 0.62, arch: 0.85, lantern: 0.95, birdhouse: 0.95 }[type] || 1.15;
  ctx.translate(32, type === 'tree' ? 58 : 46);
  ctx.scale(tall, tall);
  drawDecor(ctx, 0, 0, type, 0.5, 3);
});

export const eggIcon = (kind) => render(`egg:${kind}`, 64, 64, (ctx) => {
  ellipse(ctx, 32, 52, 12, 4, 'rgba(120,80,40,0.15)');
  drawEgg(ctx, 32, 34, 18, kind);
});

export const honeyIcon = () => render('honey', 40, 40, (ctx) => drawHoneyDrop(ctx, 20, 20, 1.8));

export const pollenIcon = () => render('pollen', 40, 40, (ctx) => {
  ellipse(ctx, 20, 20, 11, 11, '#ffd84d', '#e0a51f', 1.6);
  for (let i = 0; i < 7; i++) ellipse(ctx, 20 + Math.cos(i) * 5.5, 20 + Math.sin(i) * 5.5, 1.8, 1.8, '#f2b233');
  ellipse(ctx, 16, 15, 3, 2, 'rgba(255,255,255,0.8)');
});

export const giftIcon = () => render('gift', 64, 64, (ctx) => {
  ctx.translate(32, 48);
  ctx.scale(1.6, 1.6);
  drawGift(ctx, 0, 0, 0, 1);
});

export function img(src, cls = '') {
  return `<img class="${cls}" src="${src}" alt="" draggable="false">`;
}
