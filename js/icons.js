// Little Bee Haven — renders game art into small cached images for the HTML UI.
import { drawBee, drawFlowerTile, drawDecor, drawEgg, drawSeedPacket, drawHoneyDrop, ellipse, drawGift } from './art.js';

const cache = new Map();
const DPR = Math.min(3, window.devicePixelRatio || 1);

function render(key, w, h, fn) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
  const ctx = c.getContext('2d');
  ctx.scale(DPR, DPR);
  fn(ctx, w, h);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export const beeIcon = (species, silhouette = false) => render(`bee:${species}:${silhouette}`, 64, 64, (ctx) => {
  drawBee(ctx, 30, 36, 15, species, 0.3, { flap: false, silhouette });
});

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
