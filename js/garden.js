// Little Bee Haven — the pastel isometric cottage garden scene.
import { HIVE_TILE, FLOWERS, DECOR } from './data.js';
import {
  state, bus, tileKey, flowerStatus, bloomedFlowers, collectPollen, openGift, isHiveTile, isLand, tileFree,
  CELL_CAPACITY, LAND_TILES, nearHive, COTTAGE_TILE,
} from './state.js';
import {
  A, B, hash, ellipse, drawBee, drawFlowerTile, drawDecor, drawGardenHive,
  drawCottage, drawGift, tilePath, drawHeart, shadow,
} from './art.js';
import { Fx } from './fx.js';
import { MAP } from './map.js';

const iso = (x, y) => ({ x: (x - y) * A, y: (x + y) * B });
const MAX_FLYERS = 10;

// The garden map picture, placed in world space so its painted diamonds line up
// with the game's tiles (tile 0,0 sits at the world origin).
const MAP_W = (2 * A) / MAP.tileW;
const MAP_H = (2 * B) / MAP.tileH;
const MAP_X = -MAP.originX * MAP_W;
const MAP_Y = -MAP.originY * MAP_H;
const EDGE = 22; // soil cliff under the front of the map
const mapImg = new Image();
mapImg.decoding = 'async';
mapImg.src = MAP.src;

export class GardenScene {
  constructor(hooks) {
    this.hooks = hooks;
    this.zoom = 1;
    this.baseZoom = 1;
    this.offX = 0;
    this.offY = 0;
    this.w = 0; this.h = 0;
    this.fx = new Fx(12);
    this.flyers = [];
    this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: hash(i) * 1.2, y: 0.05 + hash(i + 3) * 0.22, s: 0.6 + hash(i + 7) * 0.7, v: 0.004 + hash(i + 2) * 0.006 }));
    this.edit = null;         // { kind, id } item selected for placing
    this.editMode = false;
    this.selected = null;     // {x,y} placed item selected in edit mode
    this.moving = null;       // {x,y} placed item being moved
    this.wiggle = {};         // tileKey -> start time of a happy wiggle
    this.hiveBounce = 0;
    this.time = 0;
  }

  resize(w, h, insets) {
    this.w = w; this.h = h; this.insets = insets;
    const availH = h - insets.top - insets.bottom;
    // show most of the map's height; on a phone that's ~1 screen tall and wider than the screen
    this.baseZoom = Math.min(2.4, Math.max(0.5, (availH * 0.8) / MAP_H));
    this.zoom = this.baseZoom;
    this.center();
  }

  // start looking at the hive and the cottage
  center() {
    const focus = iso(HIVE_TILE.x - 0.5, HIVE_TILE.y - 0.5);
    this.offX = this.w / 2 - focus.x * this.zoom;
    this.offY = this.insets.top + (this.h - this.insets.top - this.insets.bottom) / 2 - (MAP_Y + MAP_H / 2) * this.zoom;
    this.clamp();
  }

  // keep the map on screen: pan freely across it, centre it when it is smaller than the view
  clamp() {
    const axis = (off, lo, hi, v0, v1) => {
      const size = (hi - lo) * this.zoom;
      if (size <= v1 - v0) return v0 + (v1 - v0 - size) / 2 - lo * this.zoom;
      return Math.min(v0 - lo * this.zoom, Math.max(v1 - hi * this.zoom, off));
    };
    this.offX = axis(this.offX, MAP_X, MAP_X + MAP_W, 0, this.w);
    this.offY = axis(this.offY, MAP_Y - 30, MAP_Y + MAP_H + EDGE, this.insets.top, this.h - this.insets.bottom);
  }

  pan(dx, dy) { this.offX += dx; this.offY += dy; this.clamp(); }

  pinch(factor, cx, cy) {
    const nz = Math.min(this.baseZoom * 2.2, Math.max(this.baseZoom * 0.7, this.zoom * factor));
    const k = nz / this.zoom;
    this.offX = cx - (cx - this.offX) * k;
    this.offY = cy - (cy - this.offY) * k;
    this.zoom = nz;
    this.clamp();
  }

  toWorld(sx, sy) { return { x: (sx - this.offX) / this.zoom, y: (sy - this.offY) / this.zoom }; }
  toScreen(wx, wy) { return { x: this.offX + wx * this.zoom, y: this.offY + wy * this.zoom }; }

  tileAt(wx, wy) {
    const fx = (wx / A + wy / B) / 2;
    const fy = (wy / B - wx / A) / 2;
    return { x: Math.round(fx), y: Math.round(fy) };
  }

  hivePos() { return iso(HIVE_TILE.x, HIVE_TILE.y); }

  // ------------------------------------------------------------ bees in flight
  syncFlyers() {
    const want = state.bees.slice(0, MAX_FLYERS);
    if (this.flyers.length === want.length && this.flyers.every((f, i) => f.id === want[i].id)) return;
    const old = new Map(this.flyers.map((f) => [f.id, f]));
    this.flyers = want.map((b, i) => {
      const f = old.get(b.id);
      if (f) { f.species = b.species; f.name = b.name; return f; }
      const h = this.hivePos();
      return {
        id: b.id, species: b.species, name: b.name, x: h.x, y: h.y - 14, mode: 'inside',
        until: this.time + 0.4 + i * 0.9, from: null, to: null, phase: hash(i + 1) * 10, flip: false, happy: 0,
      };
    });
  }

  updateFlyers(dt) {
    const blooms = bloomedFlowers();
    const h = this.hivePos();
    const door = { x: h.x - 2, y: h.y - 4 };
    for (const f of this.flyers) {
      if (f.mode === 'inside') {
        if (this.time >= f.until) {
          let target;
          if (blooms.length) {
            const b = blooms[Math.floor(Math.random() * blooms.length)];
            const p = iso(b.x, b.y);
            target = { x: p.x + (Math.random() - 0.5) * 18, y: p.y - FLOWERS[b.tile.type].height - 4 + (Math.random() - 0.5) * 6 };
          } else {
            const near = LAND_TILES.filter((t) => nearHive(t.x, t.y, 4));
            const t = near[Math.floor(Math.random() * near.length)] || HIVE_TILE;
            const p = iso(t.x, t.y);
            target = { x: p.x, y: p.y - 18 };
          }
          this.launch(f, door, target, 'out');
        }
        continue;
      }
      if (f.mode === 'gather') {
        f.x = f.anchor.x + Math.cos(this.time * 3 + f.phase) * 5;
        f.y = f.anchor.y + Math.sin(this.time * 6 + f.phase) * 2;
        f.flip = Math.sin(this.time * 3 + f.phase) > 0;
        if (this.time >= f.until) this.launch(f, { x: f.x, y: f.y }, door, 'return');
        continue;
      }
      // flying out or home along a lazy arc
      f.p = Math.min(1, f.p + dt / f.dur);
      const e = f.p < 0.5 ? 2 * f.p * f.p : 1 - Math.pow(-2 * f.p + 2, 2) / 2;
      const nx = f.from.x + (f.to.x - f.from.x) * e;
      const ny = f.from.y + (f.to.y - f.from.y) * e - Math.sin(f.p * Math.PI) * f.arc + Math.sin(this.time * 9 + f.phase) * 1.4;
      if (Math.abs(nx - f.x) > 0.05) f.flip = nx < f.x;
      f.x = nx; f.y = ny;
      if (f.p >= 1) {
        if (f.mode === 'out') {
          f.mode = 'gather'; f.anchor = { x: f.to.x, y: f.to.y }; f.until = this.time + 1.4 + Math.random() * 2.2;
        } else {
          f.mode = 'inside'; f.until = this.time + 0.6 + Math.random() * 2.5;
        }
      }
    }
  }

  launch(f, from, to, mode) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    f.mode = mode; f.from = { ...from }; f.to = to; f.p = 0;
    f.dur = Math.max(0.8, dist / 55) * (0.85 + Math.random() * 0.3);
    f.arc = 14 + Math.random() * 22;
    f.x = from.x; f.y = from.y;
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    this.time += dt;
    this.syncFlyers();
    this.updateFlyers(dt);
    this.fx.update(dt);
    for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 1.3) c.x = -0.3; }
    if (this.hiveBounce > 0) this.hiveBounce = Math.max(0, this.hiveBounce - dt * 2.5);
  }

  drawBackground(ctx) {
    const { w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#bfe3ff');
    g.addColorStop(0.45, '#fde2ef');
    g.addColorStop(0.75, '#fff1dc');
    g.addColorStop(1, '#e7f6da');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // sun
    const sun = ctx.createRadialGradient(w * 0.82, h * 0.12, 5, w * 0.82, h * 0.12, 90);
    sun.addColorStop(0, 'rgba(255,248,200,0.95)');
    sun.addColorStop(0.35, 'rgba(255,236,170,0.5)');
    sun.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h * 0.5);
    for (const c of this.clouds) {
      const cx = c.x * w, cy = c.y * h, s = c.s * Math.min(1.4, w / 400);
      ctx.globalAlpha = 0.85;
      [[-22, 4, 18], [0, -6, 24], [24, 3, 18], [8, 8, 18], [-8, 9, 16]].forEach(([dx, dy, r]) => ellipse(ctx, cx + dx * s, cy + dy * s, r * s, r * 0.75 * s, '#ffffff'));
      ctx.globalAlpha = 1;
    }
    // rolling hills peeking over the back of the map (drift a little with the camera for depth)
    const top = this.offY + MAP_Y * this.zoom;
    const px = (this.offX - w / 2) * 0.15;
    ctx.fillStyle = '#d6efc4';
    ctx.beginPath(); ctx.ellipse(w * 0.15 + px, top + 10, w * 0.6, 70, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#cbeab6';
    ctx.beginPath(); ctx.ellipse(w * 0.85 + px, top + 14, w * 0.65, 80, 0, Math.PI, 0); ctx.fill();
    // soft meadow below the map's soil edge
    const bottom = this.offY + (MAP_Y + MAP_H + EDGE) * this.zoom;
    ctx.fillStyle = '#e6f4d6';
    ctx.fillRect(0, bottom, w, h - bottom);
  }

  drawMap(ctx, t) {
    const x0 = MAP_X, y0 = MAP_Y, x1 = MAP_X + MAP_W, y1 = MAP_Y + MAP_H;
    // soil edge along the front, like the map is a little diorama
    ctx.fillStyle = '#d9b48f';
    ctx.fillRect(x0, y1 - 2, MAP_W, EDGE + 2);
    ctx.fillStyle = '#c9a07a';
    ctx.fillRect(x0, y1 + EDGE * 0.55, MAP_W, EDGE * 0.45);
    for (let k = 0; k < 60; k++) ellipse(ctx, x0 + hash(k) * MAP_W, y1 + 5 + hash(k + 50) * (EDGE - 8), 1.6, 1.1, 'rgba(255,255,255,0.35)');
    if (mapImg.complete && mapImg.naturalWidth) {
      ctx.drawImage(mapImg, x0, y0, MAP_W, MAP_H);
    } else {
      ctx.fillStyle = '#b6e39d';
      ctx.fillRect(x0, y0, MAP_W, MAP_H);
    }
    ctx.strokeStyle = '#a7d98d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();

    if (!this.editMode) return;
    // show where things can go while decorating (only tiles on screen)
    const a = this.toWorld(0, 0), b = this.toWorld(this.w, this.h);
    for (const { x, y } of LAND_TILES) {
      const p = iso(x, y);
      if (p.x < a.x - A || p.x > b.x + A || p.y < a.y - B || p.y > b.y + B) continue;
      const sel = this.selected && this.selected.x === x && this.selected.y === y;
      if (!sel && !((this.edit || this.moving) && tileFree(x, y))) continue;
      tilePath(ctx, p.x, p.y, 0.94);
      ctx.fillStyle = sel ? 'rgba(255,214,102,0.6)' : `rgba(255,255,255,${0.26 + 0.12 * Math.sin(t * 4 + x + y)})`;
      ctx.fill();
    }
  }

  draw(ctx, dpr) {
    const t = this.time;
    this.drawBackground(ctx);
    ctx.save();
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.zoom, this.zoom);

    this.drawMap(ctx, t);

    // depth-sorted objects
    const objs = [];
    objs.push({ d: COTTAGE_TILE.x + COTTAGE_TILE.y + 0.3, draw: () => { const p = iso(COTTAGE_TILE.x, COTTAGE_TILE.y); drawCottage(ctx, p.x, p.y, t); } });
    const readyCells = state.cells.filter((cell) => cell.type === 'honey' && cell.fill >= CELL_CAPACITY).length;
    objs.push({
      d: HIVE_TILE.x + HIVE_TILE.y + 0.01,
      draw: () => {
        const p = iso(HIVE_TILE.x, HIVE_TILE.y);
        const sq = Math.sin(this.hiveBounce * Math.PI) * 0.08;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.scale(1 + sq, 1 - sq); ctx.translate(-p.x, -p.y);
        drawGardenHive(ctx, p.x, p.y, t, readyCells);
        ctx.restore();
      },
    });
    for (const [k, tile] of Object.entries(state.tiles)) {
      const [x, y] = k.split(',').map(Number);
      const p = iso(x, y);
      const seed = x * 7 + y * 13;
      const flat = tile.kind === 'decor' && DECOR[tile.type]?.flat;
      objs.push({
        d: flat ? x + y - 0.6 : x + y,
        draw: () => {
          const wig = this.wiggle[k] != null ? Math.max(0, 1 - (t - this.wiggle[k]) * 2) : 0;
          ctx.save();
          if (wig > 0) {
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.sin(t * 30) * 0.08 * wig);
            ctx.scale(1 + 0.08 * wig, 1 + 0.08 * wig);
            ctx.translate(-p.x, -p.y);
          }
          if (this.moving && this.moving.x === x && this.moving.y === y) ctx.globalAlpha = 0.45;
          if (tile.kind === 'flower') {
            const st = flowerStatus(tile);
            drawFlowerTile(ctx, p.x, p.y, tile.type, st.stage, t, st.ready, seed);
            if (!st.bloomed) this.drawGrowRing(ctx, p.x, p.y + 12, st.progress);
          } else {
            drawDecor(ctx, p.x, p.y, tile.type, t, seed);
          }
          ctx.restore();
        },
      });
    }
    for (const g of state.gifts) {
      const p = iso(g.x, g.y);
      objs.push({ d: g.x + g.y + 0.02, draw: () => drawGift(ctx, p.x, p.y, t, g.x * 3 + g.y) });
    }
    objs.sort((a, b) => a.d - b.d);
    for (const o of objs) o.draw();

    // bees fly above everything
    for (const f of this.flyers) {
      if (f.mode === 'inside') continue;
      shadow(ctx, f.x, f.y + 22, 4, 1.6, 0.1);
      const s = 5.2 * (1 + f.happy * 0.3);
      drawBee(ctx, f.x, f.y, s, f.species, t, { flip: f.flip, phase: f.phase });
      if (f.happy > 0) {
        f.happy = Math.max(0, f.happy - 0.012);
        drawHeart(ctx, f.x, f.y - 12 - (1 - f.happy) * 10, 3.5, `rgba(255,120,150,${f.happy})`);
      }
    }
    this.fx.draw(ctx, t);
    ctx.restore();
  }

  drawGrowRing(ctx, x, y, p) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.roundRect(x - 11, y - 2.5, 22, 5, 2.5); ctx.fill();
    ctx.fillStyle = '#8fd18b';
    ctx.beginPath(); ctx.roundRect(x - 10, y - 1.5, 20 * p, 3, 1.5); ctx.fill();
  }

  // ------------------------------------------------------------ input
  hitFlyer(wx, wy) {
    let best = null; let bd = 16;
    for (const f of this.flyers) {
      if (f.mode === 'inside') continue;
      const d = Math.hypot(f.x - wx, f.y - wy);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  // front-most placed object whose sprite box contains the point
  hitObject(wx, wy) {
    const cands = [];
    for (const g of state.gifts) cands.push({ kind: 'gift', g, x: g.x, y: g.y, top: 28, half: 16 });
    cands.push({ kind: 'hive', x: HIVE_TILE.x, y: HIVE_TILE.y, top: 64, half: 28 });
    for (const [k, tile] of Object.entries(state.tiles)) {
      const [x, y] = k.split(',').map(Number);
      const top = tile.kind === 'flower' ? FLOWERS[tile.type].height + 26 : ({ tree: 70, arch: 46, lantern: 44, birdhouse: 44, bush: 26, gnome: 32, birdbath: 28 }[tile.type] || 18);
      const half = tile.kind === 'flower' ? 24 : ({ lantern: 9, birdhouse: 11, gnome: 11, birdbath: 16, mushroom: 18, fence: 22 }[tile.type] || 24);
      cands.push({ kind: tile.kind, tile, x, y, top, half });
    }
    cands.sort((a, b) => (b.x + b.y) - (a.x + a.y) || (a.kind === 'gift' ? -1 : 1));
    for (const c of cands) {
      const p = iso(c.x, c.y);
      if (Math.abs(wx - p.x) <= c.half && wy >= p.y - c.top && wy <= p.y + B * 0.9) {
        // must also be on or above this tile's diamond (so the tile in front still wins)
        const rel = Math.abs(wx - p.x) / A + (wy - p.y) / B;
        if (rel <= 1.05 || wy < p.y) return c;
      }
    }
    return null;
  }

  tap(sx, sy) {
    const w = this.toWorld(sx, sy);
    if (this.editMode) return this.tapEdit(w);

    const hit = this.hitObject(w.x, w.y);
    if (hit && hit.kind === 'gift') return this.tapGift(hit.g);
    const bee = this.hitFlyer(w.x, w.y);
    if (bee) {
      bee.happy = 1;
      this.fx.text(bee.x, bee.y - 16, `${bee.name} 💛`, '#d9577b');
      this.hooks.sound('buzz');
      return;
    }
    if (!hit) {
      const t = this.tileAt(w.x, w.y);
      if (isLand(t.x, t.y)) {
        const p = iso(t.x, t.y);
        this.fx.burst(p.x, p.y, 'leaf', 5);
        const seeds = Object.values(state.inventory.seeds).reduce((a, b) => a + b, 0);
        if (seeds) this.hooks.hint('Tap ✏️ Decorate to plant your seeds here');
      }
      return;
    }
    const p = iso(hit.x, hit.y);
    if (hit.kind === 'hive') {
      this.hiveBounce = 1;
      this.hooks.sound('pop');
      this.hooks.gotoHive();
      return;
    }
    const k = tileKey(hit.x, hit.y);
    this.wiggle[k] = this.time;
    if (hit.kind === 'flower') {
      const st = flowerStatus(hit.tile);
      if (st.ready) {
        const n = collectPollen(hit.x, hit.y);
        this.fx.text(p.x, p.y - 40, `+${n} pollen`, '#d48a00');
        this.fx.burst(p.x, p.y - 30, 'pollen', 10);
        this.hooks.sound('pop');
        this.hooks.changed();
      } else if (!st.bloomed) {
        const left = (FLOWERS[hit.tile.type].growS * 1000 * (1 - st.progress)) / 1000;
        this.fx.text(p.x, p.y - 30, `${FLOWERS[hit.tile.type].name} blooms in ${fmt(left)}`, '#5f8f4e');
      } else {
        const left = (hit.tile.pollenAt - Date.now()) / 1000;
        this.fx.text(p.x, p.y - 34, `Pollen in ${fmt(left)}`, '#8a6f3a');
        this.fx.burst(p.x, p.y - 20, 'petal', 4);
      }
      return;
    }
    // decor: a little happy wiggle
    this.fx.burst(p.x, p.y - 16, 'sparkle', 6);
    this.hooks.sound('tick');
  }

  tapGift(g) {
    const p = iso(g.x, g.y);
    const res = openGift(g.id);
    if (!res) return;
    this.fx.burst(p.x, p.y - 12, 'confetti', 18);
    this.hooks.sound('chime');
    this.hooks.giftOpened(res.reward);
    this.hooks.changed();
  }

  tapEdit(w) {
    const t = this.tileAt(w.x, w.y);
    const hit = this.hitObject(w.x, w.y);
    if (hit && hit.kind === 'gift') return this.tapGift(hit.g);
    const target = hit && (hit.kind === 'flower' || hit.kind === 'decor') ? { x: hit.x, y: hit.y } : t;
    if (!isLand(target.x, target.y)) {
      this.selected = null;
      this.hooks.selectionChanged(null);
      if (this.edit || this.moving) this.hooks.hint('Plants and decorations go on the grass 🌱');
      return;
    }
    if (isHiveTile(target.x, target.y)) { this.hooks.hint('The hive stays put — it’s the heart of your garden!'); return; }
    const p = iso(target.x, target.y);

    if (this.moving) {
      if (this.hooks.moveTo(this.moving, target)) {
        this.fx.burst(p.x, p.y, 'leaf', 8);
        this.hooks.sound('place');
        this.moving = null; this.selected = null;
        this.hooks.selectionChanged(null);
      } else if (this.moving.x === target.x && this.moving.y === target.y) {
        this.moving = null; this.hooks.selectionChanged(this.selected);
      } else {
        this.hooks.hint('That spot is taken — pick an empty tile');
      }
      return;
    }

    const occupied = state.tiles[tileKey(target.x, target.y)];
    if (occupied) {
      this.selected = { x: target.x, y: target.y };
      this.hooks.selectionChanged(this.selected);
      this.hooks.sound('tick');
      return;
    }
    this.selected = null;
    this.hooks.selectionChanged(null);
    if (this.edit && tileFree(target.x, target.y)) {
      if (this.hooks.place(this.edit, target)) {
        this.fx.burst(p.x, p.y, this.edit.kind === 'seed' ? 'leaf' : 'sparkle', 10);
        this.hooks.sound('place');
      }
    } else if (!this.edit) {
      this.hooks.hint('Pick something from the tray below, then tap a tile');
    }
  }

  floatAtTile(x, y, text, color) {
    const p = iso(x, y);
    this.fx.text(p.x, p.y - 30, text, color);
  }
}

export function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
