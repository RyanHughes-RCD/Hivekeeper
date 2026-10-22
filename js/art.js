// Little Bee Haven — procedural pastel art. Everything is drawn with canvas paths
// so the game ships with zero image assets and stays crisp at any zoom.
import { SPECIES, FLOWERS, EGGS } from './data.js';

export const A = 32;   // half tile width (world units)
export const B = 16;   // half tile height

const TAU = Math.PI * 2;
const INK = 'rgba(92,64,51,0.55)';

// deterministic pseudo random from a number
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

export function shadow(ctx, x, y, rx, ry = rx * 0.45, alpha = 0.18) {
  ellipse(ctx, x, y, rx, ry, `rgba(70,90,60,${alpha})`);
}

// Point on an isometric box: i along tile x axis, j along tile y axis (tile units), z height (px).
const P = (cx, cy, i, j, z = 0) => [cx + (i - j) * A, cy + (i + j) * B - z];

// Axis-aligned isometric box. hx/hy are half extents in tile units, z0 = base elevation.
export function isoBox(ctx, cx, cy, hx, hy, z0, h, top, left, right, stroke = INK) {
  const z1 = z0 + h;
  poly(ctx, [P(cx, cy, -hx, hy, z0), P(cx, cy, hx, hy, z0), P(cx, cy, hx, hy, z1), P(cx, cy, -hx, hy, z1)], left, stroke, 0.8);
  poly(ctx, [P(cx, cy, hx, -hy, z0), P(cx, cy, hx, hy, z0), P(cx, cy, hx, hy, z1), P(cx, cy, hx, -hy, z1)], right, stroke, 0.8);
  poly(ctx, [P(cx, cy, -hx, -hy, z1), P(cx, cy, hx, -hy, z1), P(cx, cy, hx, hy, z1), P(cx, cy, -hx, hy, z1)], top, stroke, 0.8);
}

export function tilePath(ctx, cx, cy, s = 1) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - B * s);
  ctx.lineTo(cx + A * s, cy);
  ctx.lineTo(cx, cy + B * s);
  ctx.lineTo(cx - A * s, cy);
  ctx.closePath();
}

// ---------------------------------------------------------------- ground
export function drawGrassTile(ctx, cx, cy, x, y, highlight) {
  const alt = (x + y) % 2 === 0;
  tilePath(ctx, cx, cy);
  ctx.fillStyle = alt ? '#c3eaa9' : '#b6e39d';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // tiny tufts and wildflower specks for texture
  const seed = x * 31 + y * 17;
  for (let k = 0; k < 3; k++) {
    const u = hash(seed + k) - 0.5, v = hash(seed + k + 9) - 0.5;
    const px = cx + (u - v) * A * 0.9, py = cy + (u + v) * B * 0.9;
    ctx.strokeStyle = '#94cf7c';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(px - 1.5, py); ctx.lineTo(px - 2.2, py - 3);
    ctx.moveTo(px, py); ctx.lineTo(px, py - 3.6);
    ctx.moveTo(px + 1.5, py); ctx.lineTo(px + 2.2, py - 3);
    ctx.stroke();
  }
  if (hash(seed + 99) > 0.72) {
    const u = hash(seed + 3) - 0.5, v = hash(seed + 5) - 0.5;
    ellipse(ctx, cx + (u - v) * A * 0.8, cy + (u + v) * B * 0.8, 1.3, 1.3, hash(seed) > 0.5 ? '#fff' : '#ffd6e6');
  }
  if (highlight) {
    tilePath(ctx, cx, cy, 0.94);
    ctx.fillStyle = highlight;
    ctx.fill();
  }
}

export function drawPlatform(ctx, cx, cy, half) {
  isoBox(ctx, cx, cy, half, half, -18, 18, '#b6e39d', '#e2bf98', '#d4ad85', 'rgba(120,85,60,0.35)');
  // grassy lip
  const lip = (i0, j0, i1, j1) => {
    ctx.strokeStyle = '#a7d98d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const a = P(cx, cy, i0, j0, 0), b = P(cx, cy, i1, j1, 0);
    ctx.moveTo(a[0], a[1] + 1.5); ctx.lineTo(b[0], b[1] + 1.5);
    ctx.stroke();
  };
  lip(-half, half, half, half);
  lip(half, -half, half, half);
  // little pebbles in the dirt
  for (let k = 0; k < 14; k++) {
    const u = hash(k * 3.1) * 2 - 1;
    const onLeft = k % 2 === 0;
    const pt = onLeft ? P(cx, cy, u * half, half, 4 + hash(k) * 10) : P(cx, cy, half, u * half, 4 + hash(k) * 10);
    ellipse(ctx, pt[0], pt[1], 1.6, 1.1, 'rgba(255,255,255,0.35)');
  }
}

// ---------------------------------------------------------------- bees
function wing(ctx, x, y, rx, ry, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ellipse(ctx, 0, 0, rx, ry, color, 'rgba(120,150,180,0.5)', 0.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.6, ry * 0.2); ctx.lineTo(rx * 0.5, -ry * 0.1);
  ctx.stroke();
  ctx.restore();
}

function sparkle(ctx, x, y, r, color = '#fff') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}
export { sparkle };

const RAINBOW = ['#ff8fa3', '#ffc36b', '#9be08a', '#7fc7ff', '#b79af0'];

export function drawBee(ctx, x, y, s, key, t = 0, opts = {}) {
  const sp = SPECIES[key] || SPECIES.honey;
  const flap = opts.flap !== false;
  ctx.save();
  ctx.translate(x, y);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.angle) ctx.rotate(opts.angle);
  if (opts.silhouette) ctx.globalAlpha = 1;

  if (sp.acc === 'glow' && !opts.silhouette) {
    const g = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 2.4);
    g.addColorStop(0, 'rgba(210,220,255,0.55)');
    g.addColorStop(1, 'rgba(210,220,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, s * 2.4, 0, TAU); ctx.fill();
  }

  const sil = opts.silhouette ? '#cdb89a' : null;
  const bodyC = sil || sp.body;
  const stripeC = sil ? '#b8a183' : sp.stripe;
  const headC = sil || sp.head;

  // back wing
  const f = flap ? 0.5 + 0.5 * Math.sin(t * 42 + (opts.phase || 0)) : 0.2;
  wing(ctx, -s * 0.25, -s * 0.7, s * 0.5, s * (0.3 + 0.55 * f), -0.5 - f * 0.3, sil ? 'rgba(255,255,255,0.4)' : hexA(sp.wing, 0.75));

  // legs
  ctx.strokeStyle = sil || '#5c4033';
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    ctx.moveTo(k * s * 0.35, s * 0.6);
    ctx.lineTo(k * s * 0.35 - s * 0.12, s * 0.95);
  }
  ctx.stroke();

  // fuzz
  if (sp.fluffy) {
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      ellipse(ctx, Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.74, s * 0.2, s * 0.2, bodyC);
    }
  }

  // body
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.78, 0, 0, TAU);
  ctx.fillStyle = bodyC;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const bands = [-0.62, -0.18, 0.26];
  bands.forEach((bx, i) => {
    ctx.fillStyle = stripeC === 'rainbow' ? RAINBOW[(i + Math.floor(t * 2)) % RAINBOW.length] : stripeC;
    ctx.fillRect(bx * s, -s, s * 0.22, s * 2);
  });
  // belly highlight
  ellipse(ctx, -s * 0.1, -s * 0.38, s * 0.55, s * 0.18, 'rgba(255,255,255,0.35)');
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.78, 0, 0, TAU);
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.08;
  ctx.stroke();

  // stinger
  poly(ctx, [[-s * 0.95, -s * 0.12], [-s * 1.3, 0], [-s * 0.95, s * 0.12]], sil || '#5c4033');

  // head
  const hx = s * 0.88, hy = -s * 0.12, hr = s * 0.55;
  ellipse(ctx, hx, hy, hr, hr, headC, INK, s * 0.08);
  // antennae
  ctx.strokeStyle = sil || '#5c4033';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.1, hy - hr * 0.8);
  ctx.quadraticCurveTo(hx + s * 0.25, hy - hr * 1.7, hx + s * 0.5, hy - hr * 1.8);
  ctx.moveTo(hx - s * 0.15, hy - hr * 0.85);
  ctx.quadraticCurveTo(hx - s * 0.1, hy - hr * 1.8, hx + s * 0.1, hy - hr * 2.0);
  ctx.stroke();
  ellipse(ctx, hx + s * 0.5, hy - hr * 1.8, s * 0.11, s * 0.11, sil || '#5c4033');
  ellipse(ctx, hx + s * 0.1, hy - hr * 2.0, s * 0.11, s * 0.11, sil || '#5c4033');

  if (!opts.silhouette) {
    // face
    const blink = opts.sleep || (Math.sin(t * 1.3 + (opts.phase || 0) * 3) > 0.985);
    if (blink) {
      ctx.strokeStyle = '#3a2a22';
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.arc(hx + s * 0.18, hy - s * 0.05, s * 0.11, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      ellipse(ctx, hx + s * 0.18, hy - s * 0.08, s * 0.12, s * 0.15, '#3a2a22');
      ellipse(ctx, hx + s * 0.22, hy - s * 0.13, s * 0.045, s * 0.045, '#fff');
    }
    ellipse(ctx, hx + s * 0.05, hy + s * 0.18, s * 0.11, s * 0.07, 'rgba(255,120,140,0.55)');
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(hx + s * 0.3, hy + s * 0.12, s * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    drawAccessory(ctx, sp, hx, hy, hr, s, t);
  } else {
    ctx.fillStyle = '#9c8466';
    ctx.font = `bold ${s * 0.8}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', hx, hy + s * 0.04);
  }

  // front wing
  wing(ctx, s * 0.05, -s * 0.78, s * 0.55, s * (0.32 + 0.6 * f), -0.25 - f * 0.4, sil ? 'rgba(255,255,255,0.45)' : hexA(sp.wing, 0.82));
  ctx.restore();
}

function drawAccessory(ctx, sp, hx, hy, hr, s, t) {
  switch (sp.acc) {
    case 'crown': {
      const y0 = hy - hr * 0.75;
      poly(ctx, [
        [hx - hr * 0.6, y0], [hx - hr * 0.7, y0 - hr * 0.75], [hx - hr * 0.3, y0 - hr * 0.4],
        [hx, y0 - hr * 0.95], [hx + hr * 0.3, y0 - hr * 0.4], [hx + hr * 0.7, y0 - hr * 0.75], [hx + hr * 0.6, y0],
      ], '#ffd23f', '#c98a1b', s * 0.06);
      ellipse(ctx, hx, y0 - hr * 0.3, s * 0.07, s * 0.07, '#ff6f91');
      break;
    }
    case 'leaf': {
      ctx.save();
      ctx.translate(hx - hr * 0.2, hy - hr * 0.9);
      ctx.rotate(-0.6);
      ellipse(ctx, 0, -hr * 0.3, hr * 0.22, hr * 0.42, '#7cc46b', '#4f8a40', s * 0.04);
      ctx.restore();
      break;
    }
    case 'nightcap': {
      poly(ctx, [[hx - hr * 0.75, hy - hr * 0.45], [hx + hr * 0.6, hy - hr * 0.75], [hx - hr * 0.9, hy - hr * 1.7]], '#8f9ae8', INK, s * 0.05);
      ellipse(ctx, hx - hr * 0.95, hy - hr * 1.7, hr * 0.22, hr * 0.22, '#fff');
      break;
    }
    case 'flower': {
      const fx = hx - hr * 0.35, fy = hy - hr * 0.8;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        ellipse(ctx, fx + Math.cos(a) * hr * 0.22, fy + Math.sin(a) * hr * 0.22, hr * 0.17, hr * 0.17, sp.accColor || '#ff8fab');
      }
      ellipse(ctx, fx, fy, hr * 0.13, hr * 0.13, '#ffe066');
      break;
    }
    case 'bow': {
      const bx = hx - hr * 0.3, by = hy - hr * 0.85;
      poly(ctx, [[bx, by], [bx - hr * 0.45, by - hr * 0.3], [bx - hr * 0.45, by + hr * 0.25]], '#ff8fab', INK, s * 0.04);
      poly(ctx, [[bx, by], [bx + hr * 0.45, by - hr * 0.3], [bx + hr * 0.45, by + hr * 0.25]], '#ff8fab', INK, s * 0.04);
      ellipse(ctx, bx, by, hr * 0.12, hr * 0.12, '#ff6f91');
      break;
    }
    case 'sparkle': {
      const tw = 0.6 + 0.4 * Math.sin(t * 5);
      sparkle(ctx, -s * 0.9, -s * 0.9, s * 0.28 * tw, '#fff6b0');
      sparkle(ctx, s * 0.2, s * 1.0, s * 0.2 * (1.4 - tw), '#ffffff');
      break;
    }
    default: break;
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------- flowers
const PLANT_SPOTS = [[-9, -1, 0.9], [9, -2, 0.85], [0, 5, 1]];
const BIG_SPOTS = [[-6, -1, 0.95], [7, 3, 1]];

export function drawFlowerTile(ctx, x, y, type, stage, t, ready, seed = 0) {
  const f = FLOWERS[type];
  // garden bed soil
  ellipse(ctx, x, y + 1, 22, 10.5, '#d8b08b');
  ellipse(ctx, x, y, 20, 9, '#c79a73');
  for (let k = 0; k < 4; k++) ellipse(ctx, x + (hash(seed + k) - 0.5) * 30, y + (hash(seed + k + 4) - 0.5) * 12, 1.2, 0.8, 'rgba(255,255,255,0.3)');

  const spots = f.shape === 'sunflower' ? BIG_SPOTS : PLANT_SPOTS;
  const sorted = [...spots].sort((a, b) => a[1] - b[1]);
  for (const [ox, oy, k] of sorted) {
    const sway = Math.sin(t * 1.6 + seed + ox * 0.3) * 0.06;
    drawPlant(ctx, x + ox, y + oy, f, stage, k, sway, t, seed + ox);
  }

  if (ready) drawPollenBadge(ctx, x, y - f.height - 18, t, seed);
}

function stem(ctx, x, y, h, sway, color = '#79b86a') {
  const tx = x + Math.sin(sway) * h, ty = y - Math.cos(sway) * h;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway * h * 0.2, y - h * 0.5, tx, ty);
  ctx.stroke();
  return [tx, ty];
}

function leaf(ctx, x, y, len, ang, color = '#8ccf78') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.45, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPlant(ctx, x, y, f, stage, k, sway, t, seed) {
  if (stage === 0) {
    ellipse(ctx, x, y, 3.5 * k, 1.8 * k, '#a97c57');
    ellipse(ctx, x - 1, y - 0.6, 1, 0.7, '#f3dfb0');
    return;
  }
  if (stage === 1) {
    leaf(ctx, x, y, 5 * k, -2.4 + sway);
    leaf(ctx, x, y, 5 * k, -0.7 + sway);
    return;
  }
  const h = f.height * k * (stage === 2 ? 0.65 : 1);
  leaf(ctx, x, y, 6 * k, -2.6);
  leaf(ctx, x, y, 6 * k, -0.5);
  const [tx, ty] = stem(ctx, x, y, h, sway);
  if (stage === 2) {
    ellipse(ctx, tx, ty - 1.5, 2.4 * k, 3.4 * k, f.petal, INK, 0.5);
    ellipse(ctx, tx, ty + 1, 2.2 * k, 1.2 * k, '#79b86a');
    return;
  }
  const r = k;
  switch (f.shape) {
    case 'daisy':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + sway;
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
        ellipse(ctx, 3.4 * r, 0, 2.8 * r, 1.25 * r, f.petal, 'rgba(160,140,120,0.35)', 0.4);
        ctx.restore();
      }
      ellipse(ctx, tx, ty, 2.2 * r, 2.2 * r, f.center);
      break;
    case 'puff':
      leaf(ctx, x, y - 1, 4, -1.6, '#6fbf6a');
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        ellipse(ctx, tx + Math.cos(a) * 2.4 * r, ty + Math.sin(a) * 2.4 * r, 2 * r, 2 * r, i % 2 ? f.petal : f.center);
      }
      ellipse(ctx, tx, ty - 1, 2.2 * r, 2.2 * r, f.petal);
      break;
    case 'tulip':
      ctx.beginPath();
      ctx.moveTo(tx - 4 * r, ty - 4 * r);
      ctx.lineTo(tx - 2 * r, ty - 1.5 * r);
      ctx.lineTo(tx, ty - 5 * r);
      ctx.lineTo(tx + 2 * r, ty - 1.5 * r);
      ctx.lineTo(tx + 4 * r, ty - 4 * r);
      ctx.quadraticCurveTo(tx + 4.4 * r, ty + 3 * r, tx, ty + 2.5 * r);
      ctx.quadraticCurveTo(tx - 4.4 * r, ty + 3 * r, tx - 4 * r, ty - 4 * r);
      ctx.fillStyle = f.petal; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();
      ellipse(ctx, tx + 1.6 * r, ty, 1 * r, 2.2 * r, 'rgba(255,255,255,0.35)');
      break;
    case 'spike':
      for (let i = 0; i < 6; i++) {
        const yy = ty + i * 2.2 * r;
        ellipse(ctx, tx - 1.3 * r + Math.sin(i) * 0.4, yy, 1.5 * r, 1.4 * r, i % 2 ? f.petal : f.center);
        ellipse(ctx, tx + 1.3 * r, yy + 1, 1.5 * r, 1.4 * r, f.petal);
      }
      ellipse(ctx, tx, ty - 1.6 * r, 1.3 * r, 1.6 * r, f.center);
      break;
    case 'cluster':
      for (let i = 0; i < 5; i++) {
        const cx = tx + (hash(seed + i) - 0.5) * 9 * r, cy = ty + (hash(seed + i + 7) - 0.5) * 6 * r;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU;
          ellipse(ctx, cx + Math.cos(a) * 1.3 * r, cy + Math.sin(a) * 1.3 * r, 1.1 * r, 1.1 * r, f.petal);
        }
        ellipse(ctx, cx, cy, 0.7 * r, 0.7 * r, f.center);
      }
      break;
    case 'poppy':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.3;
        ellipse(ctx, tx + Math.cos(a) * 2.6 * r, ty + Math.sin(a) * 2 * r, 3.2 * r, 2.8 * r, f.petal, 'rgba(180,80,60,0.35)', 0.5);
      }
      ellipse(ctx, tx, ty, 1.8 * r, 1.6 * r, f.center);
      for (let i = 0; i < 6; i++) ellipse(ctx, tx + Math.cos(i) * 2.2 * r, ty + Math.sin(i) * 1.8 * r, 0.4, 0.4, '#3a2a22');
      break;
    case 'bell': {
      ctx.strokeStyle = '#79b86a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 6 * r, ty - 2, tx + 7 * r, ty + 3); ctx.stroke();
      [[0.15, 1], [0.55, 2], [0.95, 3]].forEach(([u, n]) => {
        const bx = tx + u * 7 * r, by = ty + u * 3 + 3 + n * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx - 2 * r, by + 2.5 * r);
        ctx.quadraticCurveTo(bx - 2 * r, by - 1.5 * r, bx, by - 1.6 * r);
        ctx.quadraticCurveTo(bx + 2 * r, by - 1.5 * r, bx + 2 * r, by + 2.5 * r);
        ctx.lineTo(bx + 1, by + 1.6 * r); ctx.lineTo(bx, by + 2.6 * r); ctx.lineTo(bx - 1, by + 1.6 * r);
        ctx.closePath();
        ctx.fillStyle = n === 2 ? f.center : f.petal; ctx.fill();
      });
      break;
    }
    case 'rose':
      leaf(ctx, tx, ty + 4, 4, 0.3, '#6fae63');
      ellipse(ctx, tx, ty, 4.2 * r, 3.8 * r, f.petal, 'rgba(160,50,80,0.4)', 0.6);
      ctx.strokeStyle = f.center; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(tx, ty, 2.6 * r, 0.3, 4.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx + 0.4, ty - 0.3, 1.3 * r, 2, 6.5); ctx.stroke();
      break;
    case 'sunflower':
      leaf(ctx, tx - 2, ty + 9, 7, 2.6, '#7cc46b');
      leaf(ctx, tx + 2, ty + 12, 7, 0.4, '#7cc46b');
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + sway;
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
        ellipse(ctx, 6.2 * r, 0, 3.6 * r, 1.6 * r, f.petal, 'rgba(200,140,40,0.4)', 0.4);
        ctx.restore();
      }
      ellipse(ctx, tx, ty, 4.4 * r, 4.4 * r, f.center);
      for (let i = 0; i < 8; i++) ellipse(ctx, tx + Math.cos(i * 2.4) * 2.4 * r, ty + Math.sin(i * 2.4) * 2.4 * r, 0.5, 0.5, '#5a3a1b');
      break;
    default: break;
  }
}

export function drawPollenBadge(ctx, x, y, t, seed = 0) {
  const bob = Math.sin(t * 3 + seed) * 2.2;
  const g = ctx.createRadialGradient(x, y + bob, 1, x, y + bob, 13);
  g.addColorStop(0, 'rgba(255,230,120,0.65)');
  g.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y + bob, 13, 0, TAU); ctx.fill();
  ellipse(ctx, x, y + bob, 5.6, 5.6, '#ffd84d', '#e0a51f', 1);
  for (let i = 0; i < 6; i++) ellipse(ctx, x + Math.cos(i) * 2.6, y + bob + Math.sin(i) * 2.6, 0.9, 0.9, '#f2b233');
  ellipse(ctx, x - 1.8, y + bob - 2, 1.4, 1, 'rgba(255,255,255,0.8)');
  const tw = 0.5 + 0.5 * Math.sin(t * 6 + seed);
  sparkle(ctx, x + 7, y + bob - 6, 2.5 * tw, '#fff');
  sparkle(ctx, x - 7, y + bob + 3, 2 * (1 - tw), '#fff8c4');
}

export function drawHoneyDrop(ctx, x, y, s = 1, fill = '#ffb81c') {
  ctx.beginPath();
  ctx.moveTo(x, y - 8 * s);
  ctx.bezierCurveTo(x + 2 * s, y - 4 * s, x + 6 * s, y - 1 * s, x + 6 * s, y + 3 * s);
  ctx.arc(x, y + 3 * s, 6 * s, 0, Math.PI);
  ctx.bezierCurveTo(x - 6 * s, y - 1 * s, x - 2 * s, y - 4 * s, x, y - 8 * s);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#c97b10';
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  ellipse(ctx, x - 2.4 * s, y + 1.5 * s, 1.4 * s, 2.2 * s, 'rgba(255,255,255,0.6)');
}

// ---------------------------------------------------------------- decorations
export function drawDecor(ctx, x, y, type, t, seed = 0) {
  switch (type) {
    case 'stones':
      [[-12, -2, 7], [2, 1, 8], [13, -3, 6], [-3, 7, 6]].forEach(([dx, dy, r]) => {
        ellipse(ctx, x + dx, y + dy + 1, r, r * 0.5, '#b8b2a7');
        ellipse(ctx, x + dx, y + dy, r, r * 0.5, '#e6e1d8', 'rgba(120,110,100,0.4)', 0.6);
      });
      break;
    case 'mushroom':
      [[-7, 2, 1], [7, -2, 0.75], [1, 6, 0.55]].sort((a, b) => a[1] - b[1]).forEach(([dx, dy, k]) => {
        const mx = x + dx, my = y + dy;
        shadow(ctx, mx, my, 7 * k);
        ctx.fillStyle = '#fff6e8';
        ctx.beginPath(); ctx.roundRect(mx - 3 * k, my - 12 * k, 6 * k, 12 * k, 2 * k); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(mx, my - 11 * k, 10 * k, 8 * k, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#ff8f8f'; ctx.fill(); ctx.stroke();
        [[-4, -14], [3, -16], [5, -12], [-1, -18]].forEach(([px, py]) => ellipse(ctx, mx + px * k, my + py * k, 1.5 * k, 1.2 * k, '#fff'));
      });
      break;
    case 'bush':
      shadow(ctx, x, y + 2, 20);
      [[-9, -6, 10, '#8fd18b'], [8, -7, 10, '#86c983'], [0, -13, 11, '#9ad895'], [0, -3, 10, '#a1dc9b']].forEach(([dx, dy, r, c]) => {
        ellipse(ctx, x + dx, y + dy, r, r * 0.9, c, 'rgba(70,120,70,0.35)', 0.6);
      });
      for (let i = 0; i < 7; i++) ellipse(ctx, x + (hash(seed + i) - 0.5) * 26, y - 4 - hash(seed + i + 3) * 16, 1.6, 1.6, i % 2 ? '#ffd1e0' : '#fff');
      break;
    case 'fence': {
      const pick = [];
      for (let u = -0.42; u <= 0.43; u += 0.12) pick.push(u);
      const at = (u) => P(x, y, u, 0, 0);
      ctx.strokeStyle = '#f3ede4'; ctx.lineWidth = 2.4;
      [8, 15].forEach((hh) => {
        const a = at(-0.45), b = at(0.45);
        ctx.beginPath(); ctx.moveTo(a[0], a[1] - hh); ctx.lineTo(b[0], b[1] - hh); ctx.stroke();
      });
      pick.forEach((u) => {
        const [px, py] = at(u);
        poly(ctx, [[px - 2.2, py], [px + 2.2, py], [px + 2.2, py - 19], [px, py - 22], [px - 2.2, py - 19]], '#fffaf2', 'rgba(140,120,100,0.5)', 0.6);
      });
      break;
    }
    case 'bench':
      shadow(ctx, x, y + 3, 22);
      ctx.strokeStyle = '#8a6a50'; ctx.lineWidth = 2;
      [[-0.32, 0.1], [0.32, 0.1], [-0.32, -0.1], [0.32, -0.1]].forEach(([i, j]) => {
        const a = P(x, y, i, j, 0), b = P(x, y, i, j, 9);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      isoBox(ctx, x, y, 0.38, 0.13, 9, 3, '#a9d6f5', '#86bde6', '#95c8ec');
      isoBox(ctx, x, y - 2, 0.38, 0.03, 12, 12, '#a9d6f5', '#86bde6', '#95c8ec');
      break;
    case 'lantern': {
      const glow = 0.75 + 0.25 * Math.sin(t * 2.2 + seed);
      const g = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 30);
      g.addColorStop(0, `rgba(255,226,140,${0.55 * glow})`);
      g.addColorStop(1, 'rgba(255,226,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 30, 30, 0, TAU); ctx.fill();
      shadow(ctx, x, y, 8);
      ctx.fillStyle = '#6d5a73'; ctx.fillRect(x - 1.5, y - 26, 3, 26);
      ellipse(ctx, x, y, 4, 2, '#6d5a73');
      ctx.fillStyle = '#6d5a73'; ctx.fillRect(x - 5, y - 38, 10, 2);
      ctx.fillStyle = `rgba(255,236,160,${glow})`;
      ctx.beginPath(); ctx.roundRect(x - 4.5, y - 36, 9, 10, 2); ctx.fill();
      ctx.strokeStyle = '#6d5a73'; ctx.lineWidth = 1; ctx.stroke();
      poly(ctx, [[x - 6, y - 37], [x + 6, y - 37], [x, y - 43]], '#7c6a84');
      break;
    }
    case 'gnome': {
      shadow(ctx, x, y + 1, 9);
      ellipse(ctx, x, y - 6, 7, 7.5, '#7fb2e8', INK, 0.6);
      ellipse(ctx, x - 3, y, 2.5, 1.6, '#6b4b3a');
      ellipse(ctx, x + 3, y, 2.5, 1.6, '#6b4b3a');
      poly(ctx, [[x - 5, y - 13], [x + 5, y - 13], [x, y - 2]], '#ffffff', 'rgba(150,150,150,0.5)', 0.5);
      ellipse(ctx, x, y - 15, 4.4, 4, '#ffd7bd', INK, 0.5);
      ellipse(ctx, x, y - 13.5, 1.6, 1.3, '#ffa8a0');
      ellipse(ctx, x - 1.8, y - 16, 0.7, 0.7, '#3a2a22');
      ellipse(ctx, x + 1.8, y - 16, 0.7, 0.7, '#3a2a22');
      poly(ctx, [[x - 5.5, y - 17], [x + 5.5, y - 17], [x + 2, y - 31]], '#ff7a7a', INK, 0.6);
      break;
    }
    case 'birdbath': {
      shadow(ctx, x, y + 1, 12);
      ctx.fillStyle = '#d9d4cc'; ctx.beginPath(); ctx.roundRect(x - 3, y - 16, 6, 16, 2); ctx.fill();
      ellipse(ctx, x, y, 7, 3, '#cfc9c0');
      ellipse(ctx, x, y - 17, 15, 6, '#e8e3db', 'rgba(120,110,100,0.5)', 0.7);
      ellipse(ctx, x, y - 18, 12, 4.2, '#9fd6f2');
      ellipse(ctx, x - 4, y - 19, 3, 1, 'rgba(255,255,255,0.7)');
      // a little bird visits now and then
      if (Math.sin(t * 0.4 + seed) > 0.2) {
        const bx = x + 9, by = y - 21;
        ellipse(ctx, bx, by, 4, 3, '#ffb3a0', INK, 0.5);
        ellipse(ctx, bx + 3, by - 3, 2.4, 2.4, '#ffb3a0', INK, 0.5);
        poly(ctx, [[bx + 5, by - 3], [bx + 7.2, by - 2.4], [bx + 5, by - 2]], '#f2a33a');
        ellipse(ctx, bx + 3.6, by - 3.6, 0.5, 0.5, '#3a2a22');
      }
      break;
    }
    case 'pond': {
      ellipse(ctx, x, y + 1, 27, 13, '#cfc6b8');
      ellipse(ctx, x, y, 25, 11.5, '#8fcde8');
      ellipse(ctx, x + 2, y + 1, 20, 8.5, '#7cc2e3');
      const r = (t * 6 + seed) % 14;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 - r / 24})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(x - 8, y + 1, r, r * 0.45, 0, 0, TAU); ctx.stroke();
      ellipse(ctx, x + 7, y - 2, 6, 3, '#86c983');
      for (let i = 0; i < 5; i++) ellipse(ctx, x + 7 + Math.cos(i * 1.25) * 1.6, y - 4 + Math.sin(i * 1.25) * 0.9, 1.4, 1.1, '#ffc1d6');
      ellipse(ctx, x - 12, y - 1, 3.6, 1.8, '#9ad895');
      [[-22, 0], [20, 4], [-6, 10], [14, -9]].forEach(([dx, dy]) => ellipse(ctx, x + dx, y + dy, 3, 1.8, '#e2ddd3', 'rgba(120,110,100,0.4)', 0.5));
      break;
    }
    case 'birdhouse': {
      shadow(ctx, x, y + 1, 8);
      ctx.fillStyle = '#b08968'; ctx.fillRect(x - 1.5, y - 24, 3, 24);
      isoBox(ctx, x, y, 0.13, 0.13, 22, 12, '#ffe7a3', '#ffd6a5', '#ffe0b8');
      const r1 = P(x, y, -0.18, 0, 34), r2 = P(x, y, 0.18, 0, 34);
      poly(ctx, [P(x, y, -0.18, 0.18, 33), P(x, y, 0.18, 0.18, 33), [r2[0], r2[1] - 7], [r1[0], r1[1] - 7]], '#f29b9b', INK, 0.6);
      poly(ctx, [P(x, y, 0.18, -0.18, 33), P(x, y, 0.18, 0.18, 33), [r2[0], r2[1] - 7]], '#ffe0b8', INK, 0.6);
      const hole = P(x, y, -0.02, 0.13, 28);
      ellipse(ctx, hole[0], hole[1], 2, 2.3, '#5c4033');
      break;
    }
    case 'arch': {
      const L = P(x, y, -0.4, 0, 0), R = P(x, y, 0.4, 0, 0);
      shadow(ctx, x, y + 2, 24, 8, 0.12);
      ctx.strokeStyle = '#fffaf2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(L[0], L[1]); ctx.lineTo(L[0], L[1] - 26);
      ctx.bezierCurveTo(L[0], L[1] - 46, R[0], R[1] - 46, R[0], R[1] - 26);
      ctx.lineTo(R[0], R[1]);
      ctx.stroke();
      ctx.strokeStyle = '#8ccf78'; ctx.lineWidth = 1.4; ctx.stroke();
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        let px, py;
        if (u < 0.3) { px = L[0]; py = L[1] - (u / 0.3) * 26; } else if (u > 0.7) { px = R[0]; py = R[1] - ((1 - u) / 0.3) * 26; } else {
          const v = (u - 0.3) / 0.4;
          const mt = 1 - v;
          px = mt * mt * mt * L[0] + 3 * mt * mt * v * L[0] + 3 * mt * v * v * R[0] + v * v * v * R[0];
          py = mt * mt * mt * (L[1] - 26) + 3 * mt * mt * v * (L[1] - 46) + 3 * mt * v * v * (R[1] - 46) + v * v * v * (R[1] - 26);
        }
        leaf(ctx, px, py, 4, i * 1.7, '#7cc46b');
        if (i % 2 === 0) ellipse(ctx, px + 1, py - 1, 2.4, 2.2, i % 4 ? '#ff8fab' : '#ffc1d6', 'rgba(160,50,80,0.4)', 0.4);
      }
      break;
    }
    case 'tree': {
      shadow(ctx, x, y + 2, 24, 10);
      ctx.fillStyle = '#a0765a';
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x - 2.5, y - 30); ctx.lineTo(x + 2.5, y - 30); ctx.lineTo(x + 4, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a0765a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x - 9, y - 34); ctx.moveTo(x, y - 26); ctx.lineTo(x + 8, y - 37); ctx.stroke();
      drawBlossomCanopy(ctx, x, y - 44, 1, seed);
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.25 + hash(seed + i)) % 1;
        const px = x + (hash(seed + i * 3) - 0.5) * 40 + Math.sin(t * 2 + i) * 4;
        const py = y - 40 + ph * 44;
        ctx.globalAlpha = 1 - ph;
        ellipse(ctx, px, py, 1.8, 1.1, '#ffc1d6');
        ctx.globalAlpha = 1;
      }
      break;
    }
    default: break;
  }
}

export function drawBlossomCanopy(ctx, x, y, s = 1, seed = 0) {
  const blobs = [[-14, 4, 12], [13, 3, 12], [0, -8, 14], [-6, 8, 11], [8, 9, 11], [0, 2, 13]];
  blobs.forEach(([dx, dy, r], i) => ellipse(ctx, x + dx * s, y + dy * s, r * s, r * 0.9 * s, i % 2 ? '#ffc8da' : '#ffd6e4', 'rgba(220,120,150,0.3)', 0.6));
  for (let i = 0; i < 12; i++) ellipse(ctx, x + (hash(seed + i) - 0.5) * 34 * s, y + (hash(seed + i + 5) - 0.5) * 22 * s, 1.5 * s, 1.5 * s, i % 3 ? '#fff' : '#ff9fbf');
}

export function drawRoundTree(ctx, x, y, s = 1, colors = ['#9ad895', '#8fd18b', '#a8e0a0']) {
  shadow(ctx, x, y + 2, 20 * s, 8 * s);
  ctx.fillStyle = '#a0765a';
  ctx.fillRect(x - 3 * s, y - 22 * s, 6 * s, 22 * s);
  [[-10, -30, 13], [10, -31, 13], [0, -42, 15], [0, -28, 14]].forEach(([dx, dy, r], i) => {
    ellipse(ctx, x + dx * s, y + dy * s, r * s, r * 0.92 * s, colors[i % colors.length], 'rgba(70,120,70,0.3)', 0.7);
  });
  ellipse(ctx, x - 5 * s, y - 46 * s, 5 * s, 3 * s, 'rgba(255,255,255,0.35)');
}

// ---------------------------------------------------------------- hive & cottage
export function drawGardenHive(ctx, x, y, t, readyCount = 0) {
  shadow(ctx, x, y + 3, 30, 13, 0.2);
  // stand legs
  ctx.strokeStyle = '#9b7a5e'; ctx.lineWidth = 3;
  [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.3]].forEach(([i, j]) => {
    const a = P(x, y, i, j, 0), b = P(x, y, i, j, 7);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  });
  isoBox(ctx, x, y, 0.38, 0.38, 7, 4, '#c9a27e', '#b08968', '#bf9775');
  isoBox(ctx, x, y, 0.33, 0.33, 11, 16, '#ffe9a8', '#ffd97a', '#ffe28f');
  isoBox(ctx, x, y, 0.33, 0.33, 27, 13, '#ffe3ec', '#ffcfdc', '#ffd9e4');
  isoBox(ctx, x, y, 0.33, 0.33, 40, 10, '#e2f5e5', '#c5ead0', '#d3f0da');
  isoBox(ctx, x, y, 0.4, 0.4, 50, 4, '#f6b38a', '#e8996d', '#f0a57b');
  isoBox(ctx, x, y, 0.22, 0.22, 54, 3, '#f6b38a', '#e8996d', '#f0a57b');
  // hand-painted heart and entrance
  const e1 = P(x, y, -0.2, 0.33, 12.5), e2 = P(x, y, 0.15, 0.33, 12.5);
  ctx.strokeStyle = '#5c4033'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.stroke();
  const hp = P(x, y, 0.33, 0, 33);
  drawHeart(ctx, hp[0], hp[1], 3.2, '#ff8fab');
  const hp2 = P(x, y, 0, 0.33, 21);
  ctx.fillStyle = 'rgba(201,123,16,0.55)';
  ctx.font = 'bold 7px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('♥', hp2[0], hp2[1] + 2);
  // honey drip on the front
  const d = P(x, y, -0.33, 0.1, 26);
  ctx.fillStyle = '#ffc233';
  ctx.beginPath(); ctx.moveTo(d[0] - 1, d[1] - 6); ctx.lineTo(d[0] + 2, d[1] - 6);
  ctx.quadraticCurveTo(d[0] + 2, d[1] + 2 + Math.sin(t * 1.5) * 1.5, d[0] + 0.5, d[1] + 3 + Math.sin(t * 1.5) * 1.5);
  ctx.quadraticCurveTo(d[0] - 1, d[1] + 2, d[0] - 1, d[1] - 6); ctx.fill();

  if (readyCount > 0) {
    const bob = Math.sin(t * 3) * 2.5;
    const bx = x, by = y - 80 + bob;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.roundRect(bx - 16, by - 10, 32, 20, 10); ctx.fill();
    poly(ctx, [[bx - 4, by + 9], [bx + 4, by + 9], [bx, by + 14]], 'rgba(255,255,255,0.92)');
    drawHoneyDrop(ctx, bx - 6, by + 0.5, 0.75);
    ctx.fillStyle = '#c97b10';
    ctx.font = 'bold 10px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(readyCount), bx + 6, by + 1);
  }
}

export function drawHeart(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.4, x, y - s * 0.5);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  ctx.fill();
}

export function drawCottage(ctx, x, y, t) {
  const hx = 1.05, hy = 0.8, H = 50, R = 30;
  shadow(ctx, x, y + 6, 80, 30, 0.15);
  isoBox(ctx, x, y, hx, hy, 0, 6, '#e8dccb', '#d6c4ad', '#e0cfb8');
  isoBox(ctx, x, y, hx - 0.04, hy - 0.04, 6, H - 6, '#fff5e6', '#fde8cf', '#fff0dc');

  // timber beams on the front-left wall
  const wall = (i, z) => P(x, y, i, hy - 0.04, z);
  ctx.strokeStyle = 'rgba(176,137,104,0.55)'; ctx.lineWidth = 2;
  [-0.95, 0.95].forEach((i) => { const a = wall(i, 6), b = wall(i, H); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
  // door
  const dq = [wall(0.15, 6), wall(0.55, 6), wall(0.55, 32), wall(0.15, 32)];
  poly(ctx, dq, '#a8d5e2', INK, 0.8);
  const knob = wall(0.48, 18); ellipse(ctx, knob[0], knob[1], 1.2, 1.2, '#f2b233');
  const dt = wall(0.35, 36); drawHeart(ctx, dt[0], dt[1], 3, '#ff8fab');
  // window left
  const win = (fn, a0, a1, z0, z1) => {
    const q = [fn(a0, z0), fn(a1, z0), fn(a1, z1), fn(a0, z1)];
    poly(ctx, q, '#cfefff', '#fff', 2.2);
    const m1 = fn((a0 + a1) / 2, z0), m2 = fn((a0 + a1) / 2, z1);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke();
    // flower box
    const b0 = fn(a0 - 0.05, z0 - 1), b1 = fn(a1 + 0.05, z0 - 1);
    ctx.strokeStyle = '#c9a27e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
    for (let k = 0; k <= 5; k++) {
      const u = a0 + (a1 - a0) * (k / 5);
      const p = fn(u, z0 + 2);
      ellipse(ctx, p[0], p[1], 2, 2, ['#ff8fab', '#ffe066', '#b79ae8', '#fff'][k % 4]);
    }
  };
  win((i, z) => wall(i, z), -0.75, -0.25, 20, 36);
  win((j, z) => P(x, y, hx - 0.04, j, z), -0.35, 0.25, 20, 36);

  // gable roof (ridge along x)
  const o = 0.12;
  const back = [P(x, y, -hx - o, -hy - o, H - 2), P(x, y, hx + o, -hy - o, H - 2), P(x, y, hx + o, 0, H + R), P(x, y, -hx - o, 0, H + R)];
  const front = [P(x, y, -hx - o, hy + o, H - 2), P(x, y, hx + o, hy + o, H - 2), P(x, y, hx + o, 0, H + R), P(x, y, -hx - o, 0, H + R)];
  poly(ctx, back, '#f7a8a0', INK, 0.8);
  // chimney with smoke
  isoBox(ctx, x, y, 0.12, 0.12, H + 6, 34, '#e8b4a0', '#d99e88', '#e2a995', INK);
  const ch = P(x, y, 0, 0, H + 40);
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.22 + k / 3) % 1;
    ctx.globalAlpha = 0.55 * (1 - ph);
    ellipse(ctx, ch[0] + Math.sin(ph * 6 + k) * 4 + ph * 10, ch[1] - ph * 34, 4 + ph * 6, 3.5 + ph * 5, '#ffffff');
    ctx.globalAlpha = 1;
  }
  poly(ctx, [P(x, y, hx - 0.04, -hy, H - 2), P(x, y, hx - 0.04, hy, H - 2), P(x, y, hx - 0.04, 0, H + R - 2)], '#fff0dc', INK, 0.8);
  const roundWin = P(x, y, hx - 0.04, 0, H + 10);
  ellipse(ctx, roundWin[0], roundWin[1], 4, 5, '#cfefff', '#fff', 1.6);
  poly(ctx, front, '#f4978e', INK, 0.8);
  // shingle rows
  ctx.strokeStyle = 'rgba(200,100,100,0.35)'; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    const j = (hy + o) * (1 - k / 4), z = H - 2 + (R + 2) * (k / 4);
    const a = P(x, y, -hx - o, j, z), b = P(x, y, hx + o, j, z);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
}

// ---------------------------------------------------------------- gifts & eggs
const GIFT_COLORS = [
  ['#ffd1dc', '#ffbfd0', '#ffc8d6', '#8fc9f5'],
  ['#cfe8ff', '#b5dbff', '#c2e1ff', '#ff8fab'],
  ['#fff1b0', '#ffe48a', '#ffea9e', '#b79ae8'],
  ['#d8f5d0', '#c0ecb5', '#ccf0c2', '#ff9a76'],
];
export function drawGift(ctx, x, y, t, seed = 0, scale = 1) {
  const [top, left, right, ribbon] = GIFT_COLORS[Math.floor(hash(seed) * GIFT_COLORS.length)];
  const hop = Math.max(0, Math.sin(t * 2.4 + seed * 3)) * 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  shadow(ctx, 0, 1, 12 - hop * 0.6, 5);
  ctx.translate(0, -hop);
  isoBox(ctx, 0, 0, 0.17, 0.17, 0, 13, top, left, right);
  // ribbon
  ctx.strokeStyle = ribbon; ctx.lineWidth = 2.4;
  const r = (i, j, z) => P(0, 0, i, j, z);
  const l = [[r(0, 0.17, 0), r(0, 0.17, 13)], [r(0.17, 0, 0), r(0.17, 0, 13)], [r(-0.17, 0, 13), r(0.17, 0, 13)], [r(0, -0.17, 13), r(0, 0.17, 13)]];
  l.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
  const tp = r(0, 0, 13);
  ellipse(ctx, tp[0] - 4, tp[1] - 3, 4, 2.6, ribbon, INK, 0.5);
  ellipse(ctx, tp[0] + 4, tp[1] - 3, 4, 2.6, ribbon, INK, 0.5);
  ellipse(ctx, tp[0], tp[1] - 2, 1.8, 1.8, '#fff');
  ctx.restore();
  const tw = 0.5 + 0.5 * Math.sin(t * 5 + seed);
  sparkle(ctx, x + 12 * scale, y - 20 * scale, 3 * tw, '#fff6b0');
  sparkle(ctx, x - 11 * scale, y - 12 * scale, 2.2 * (1 - tw), '#ffffff');
}

export function drawEgg(ctx, x, y, s, kind, t = 0, wobble = 0) {
  const e = EGGS[kind] || EGGS.common;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 9) * wobble);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.75, -s, s * 0.8, s * 0.7, 0, s * 0.72);
  ctx.bezierCurveTo(-s * 0.8, s * 0.7, -s * 0.75, -s, 0, -s);
  ctx.fillStyle = e.color; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = s * 0.06; ctx.stroke();
  [[-0.25, -0.3, 0.14], [0.25, 0.05, 0.18], [-0.15, 0.35, 0.12], [0.2, -0.55, 0.1]].forEach(([dx, dy, r]) => ellipse(ctx, dx * s, dy * s, r * s, r * s * 0.85, e.spot));
  ellipse(ctx, -s * 0.25, -s * 0.45, s * 0.12, s * 0.22, 'rgba(255,255,255,0.7)');
  if (kind === 'royal') {
    poly(ctx, [[-s * 0.3, -s * 0.85], [-s * 0.35, -s * 1.15], [-s * 0.12, -s * 0.98], [0, -s * 1.25], [s * 0.12, -s * 0.98], [s * 0.35, -s * 1.15], [s * 0.3, -s * 0.85]], '#ffd23f', '#c98a1b', s * 0.04);
  }
  ctx.restore();
}

export function drawSeedPacket(ctx, x, y, s, type) {
  const f = FLOWERS[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#fff7ea';
  ctx.beginPath(); ctx.roundRect(-s * 0.7, -s, s * 1.4, s * 2, s * 0.15); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = s * 0.05; ctx.stroke();
  ctx.fillStyle = f.petal === '#ffffff' ? '#cdeccf' : hexA(f.petal, 0.35);
  ctx.fillRect(-s * 0.7, -s * 0.55, s * 1.4, s * 1.05);
  ctx.restore();
  ctx.save();
  ctx.translate(x, y + s * 0.55);
  const k = s / 14;
  ctx.scale(k * 1.4, k * 1.4);
  drawPlant(ctx, 0, 0, f, 3, 0.95, 0, 0, 1);
  ctx.restore();
}
