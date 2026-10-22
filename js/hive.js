// Little Bee Haven — the warm hexagonal hive interior scene.
import { EGGS, honeyPerCell } from './data.js';
import {
  state, harvestCell, eggStatus, cellNeighborsOpen, nextCellCost, CELL_CAPACITY,
} from './state.js';
import { drawEgg, drawHoneyDrop, ellipse, sparkle, hash } from './art.js';
import { Fx } from './fx.js';
import { drawBeeTop } from './beeart.js';
import { fmt } from './garden.js';

const SQ3 = Math.sqrt(3);
const MAX_CRAWLERS = 16;
const QUEEN_LOOKS = { species: 'queen', legs: 0, wings: 1 };

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export class HiveScene {
  constructor(hooks) {
    this.hooks = hooks;
    this.fx = new Fx(16, 2);
    this.size = 30;
    this.cx = 0; this.cy = 0;
    this.time = 0;
    this.crawlers = [];
    this.pulse = {};       // cell index -> time of last tap
    this.motes = Array.from({ length: 22 }, (_, i) => ({ x: hash(i), y: hash(i + 40), r: 1 + hash(i + 80) * 2.5, v: 0.01 + hash(i + 9) * 0.02 }));
    this.bg = null;
  }

  resize(w, h, insets) {
    this.w = w; this.h = h; this.insets = insets;
    const availH = h - insets.top - insets.bottom - 50;
    this.size = Math.min(w / 11.6, availH / 12.4, 58);
    this.cx = w / 2;
    this.cy = insets.top + 34 + availH / 2;
    this.bg = null;
    for (const c of this.crawlers) { c.x = this.cx; c.y = this.cy; c.tx = c.x; c.ty = c.y; }
  }

  cellPos(c) {
    return { x: this.cx + this.size * 1.5 * c.q, y: this.cy + this.size * SQ3 * (c.r + c.q / 2) };
  }

  cellAt(sx, sy) {
    const x = (sx - this.cx) / this.size, y = (sy - this.cy) / this.size;
    const q = (2 / 3) * x;
    const r = (-1 / 3) * x + (SQ3 / 3) * y;
    // cube rounding
    let rx = q, rz = r, ry = -q - r;
    let qx = Math.round(rx), qz = Math.round(rz), qy = Math.round(ry);
    const dx = Math.abs(qx - rx), dy = Math.abs(qy - ry), dz = Math.abs(qz - rz);
    if (dx > dy && dx > dz) qx = -qy - qz; else if (dy <= dz) qz = -qx - qy;
    return state.cells.findIndex((c) => c.q === qx && c.r === qz);
  }

  // ------------------------------------------------------------ crawling bees
  syncCrawlers() {
    const want = state.bees.slice(0, MAX_CRAWLERS);
    if (this.crawlers.length === want.length && this.crawlers.every((c, i) => c.id === want[i].id)) return;
    const old = new Map(this.crawlers.map((c) => [c.id, c]));
    this.crawlers = want.map((b, i) => {
      const o = old.get(b.id);
      if (o) { Object.assign(o, { species: b.species, name: b.name, legs: b.legs, wings: b.wings }); return o; }
      const open = state.cells.filter((c) => c.type !== 'locked' && c.type !== 'queen');
      const cell = open[i % Math.max(1, open.length)] || state.cells[0];
      const p = this.cellPos(cell);
      p.x += this.size * 0.98;
      return { id: b.id, name: b.name, species: b.species, legs: b.legs, wings: b.wings, x: p.x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2, angle: hash(i + 5) * 6.28, phase: hash(i + 2) * 9, buzz: 0, happy: 0 };
    });
  }

  updateCrawlers(dt) {
    const open = state.cells.filter((c) => c.type !== 'locked' && c.type !== 'queen');
    const speed = this.size * 0.9;
    for (const c of this.crawlers) {
      if (c.wait > 0) { c.wait -= dt; c.buzz = Math.max(0, c.buzz - dt); continue; }
      const dx = c.tx - c.x, dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 1.5) {
        c.wait = 0.8 + Math.random() * 3;
        if (Math.random() < 0.3) c.buzz = 0.6;
        const cell = open[Math.floor(Math.random() * open.length)];
        if (cell) {
          // walk along the wax walls (cell corners) so eggs and honey stay visible
          const p = this.cellPos(cell);
          const a = (Math.PI / 3) * Math.floor(Math.random() * 6);
          c.tx = p.x + Math.cos(a) * this.size * 0.98; c.ty = p.y + Math.sin(a) * this.size * 0.98;
        }
        continue;
      }
      const step = Math.min(d, speed * dt);
      c.x += (dx / d) * step; c.y += (dy / d) * step;
      // turn toward where it's walking (sprites face up the screen at angle 0)
      let turn = Math.atan2(dy, dx) + Math.PI / 2 - c.angle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      c.angle += turn * Math.min(1, dt * 8);
    }
  }

  update(dt) {
    this.time += dt;
    this.syncCrawlers();
    this.updateCrawlers(dt);
    this.fx.update(dt);
    for (const m of this.motes) { m.y -= m.v * dt; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } }
  }

  // ------------------------------------------------------------ drawing
  drawBackground(ctx) {
    const { w, h } = this;
    const g = ctx.createRadialGradient(w / 2, h * 0.5, 20, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#ffd27a');
    g.addColorStop(0.55, '#f7a93b');
    g.addColorStop(1, '#d9781f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // big soft comb pattern behind the cells
    const R = this.size * 1.9;
    ctx.strokeStyle = 'rgba(255,240,200,0.12)';
    ctx.lineWidth = 3;
    for (let col = -1; col < w / (R * 1.5) + 1; col++) {
      for (let row = -1; row < h / (R * SQ3) + 1; row++) {
        const x = col * R * 1.5, y = row * R * SQ3 + (col % 2 ? R * SQ3 / 2 : 0);
        hexPath(ctx, x, y, R * 0.94);
        ctx.stroke();
      }
    }
    for (const m of this.motes) {
      const tw = 0.4 + 0.4 * Math.sin(this.time * 2 + m.x * 20);
      ellipse(ctx, m.x * w, m.y * h, m.r, m.r, `rgba(255,248,214,${tw})`);
    }
    // warm vignette
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(120,50,0,0)');
    v.addColorStop(1, 'rgba(120,50,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  draw(ctx) {
    const t = this.time;
    this.drawBackground(ctx);
    const s = this.size;
    const now = Date.now();

    // wax frame behind the whole comb (soft drop shadow, then the frame)
    for (const c of state.cells) {
      const p = this.cellPos(c);
      hexPath(ctx, p.x, p.y + s * 0.16, s * 1.06);
      ctx.fillStyle = 'rgba(130,55,0,0.22)';
      ctx.fill();
    }
    for (const c of state.cells) {
      const p = this.cellPos(c);
      hexPath(ctx, p.x, p.y, s * 1.04);
      ctx.fillStyle = '#e8922a';
      ctx.fill();
    }

    state.cells.forEach((c, i) => this.drawCell(ctx, c, i, t, now));

    for (const c of this.crawlers) {
      const bs = s * 0.4 * (1 + c.happy * 0.25);
      ellipse(ctx, c.x + 2, c.y + 3, bs * 0.75, bs * 0.95, 'rgba(110,50,0,0.16)');
      drawBeeTop(ctx, c.x, c.y, bs, c, t, { angle: c.angle, flap: c.buzz > 0, walk: c.wait <= 0, phase: c.phase });
      if (c.happy > 0) {
        c.happy = Math.max(0, c.happy - 0.015);
      }
    }
    this.fx.draw(ctx, t);
  }

  drawCell(ctx, c, i, t, now) {
    const s = this.size;
    const p = this.cellPos(c);
    const tapK = this.pulse[i] != null ? Math.max(0, 1 - (t - this.pulse[i]) * 4) : 0;
    const r = s * (0.98 - tapK * 0.06);

    // rim
    hexPath(ctx, p.x, p.y, r);
    const rim = ctx.createLinearGradient(p.x, p.y - r, p.x, p.y + r);
    rim.addColorStop(0, '#ffcf6a');
    rim.addColorStop(1, '#e48b22');
    ctx.fillStyle = c.type === 'locked' ? '#c4741c' : rim;
    ctx.fill();

    const ir = r * 0.84;
    hexPath(ctx, p.x, p.y, ir);
    if (c.type === 'locked') {
      ctx.fillStyle = '#b5661a';
      ctx.fill();
      const can = cellNeighborsOpen(i);
      if (can) {
        ctx.fillStyle = 'rgba(255,236,190,0.18)';
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,240,200,0.75)';
        ctx.lineWidth = 1.5;
        hexPath(ctx, p.x, p.y, ir * 0.82); ctx.stroke();
        ctx.setLineDash([]);
        const cost = nextCellCost();
        ctx.fillStyle = state.honey >= cost ? '#fff6dc' : 'rgba(255,240,210,0.6)';
        ctx.font = `800 ${s * 0.42}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', p.x, p.y - s * 0.2);
        ctx.font = `800 ${s * 0.26}px ui-rounded, system-ui, sans-serif`;
        ctx.fillText(`${cost}`, p.x + s * 0.12, p.y + s * 0.26);
        drawHoneyDrop(ctx, p.x - s * 0.24, p.y + s * 0.24, s * 0.022);
      }
      return;
    }

    if (c.type === 'queen') {
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, ir);
      g.addColorStop(0, '#fff4c8');
      g.addColorStop(1, '#ffc94a');
      ctx.fillStyle = g; ctx.fill();
      const glow = 0.5 + 0.5 * Math.sin(t * 1.6);
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + glow * 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      // the hive's own queen mother rests in the royal cell
      drawBeeTop(ctx, p.x, p.y + Math.sin(t * 2) * 1.2, s * 0.62, QUEEN_LOOKS, t, { flap: Math.sin(t * 0.7) > 0.8, phase: 1 });
      return;
    }

    if (c.type === 'honey') {
      const full = c.fill >= CELL_CAPACITY;
      const g = ctx.createLinearGradient(p.x, p.y - ir, p.x, p.y + ir);
      g.addColorStop(0, '#ffeec4');
      g.addColorStop(1, '#ffd98c');
      ctx.fillStyle = g; ctx.fill();
      if (!full && c.fill > 0) {
        ctx.save();
        hexPath(ctx, p.x, p.y, ir);
        ctx.clip();
        const level = c.fill / CELL_CAPACITY;
        const top = p.y + ir - level * ir * 2;
        const hg = ctx.createLinearGradient(p.x, top, p.x, p.y + ir);
        hg.addColorStop(0, '#ffbe3b');
        hg.addColorStop(1, '#f08a0c');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(p.x - ir, p.y + ir);
        for (let k = 0; k <= 12; k++) {
          const x = p.x - ir + (k / 12) * ir * 2;
          ctx.lineTo(x, top + Math.sin(t * 2.5 + k * 0.9 + i) * 1.6);
        }
        ctx.lineTo(p.x + ir, p.y + ir);
        ctx.closePath();
        ctx.fill();
        ellipse(ctx, p.x - ir * 0.35, top + 4, ir * 0.25, 1.5, 'rgba(255,255,255,0.45)');
        ctx.restore();
      }
      if (full) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
        hexPath(ctx, p.x, p.y, r * (1.02 + pulse * 0.05));
        ctx.fillStyle = `rgba(255,246,190,${0.35 + pulse * 0.35})`;
        ctx.fill();
        hexPath(ctx, p.x, p.y, ir);
        const cg = ctx.createRadialGradient(p.x - ir * 0.3, p.y - ir * 0.35, 2, p.x, p.y, ir * 1.1);
        cg.addColorStop(0, '#fff3b8');
        cg.addColorStop(0.5, '#ffd34d');
        cg.addColorStop(1, '#f2a516');
        ctx.fillStyle = cg;
        ctx.fill();
        // wax cap texture
        ctx.strokeStyle = 'rgba(214,140,20,0.35)';
        ctx.lineWidth = 1;
        hexPath(ctx, p.x, p.y, ir * 0.62); ctx.stroke();
        hexPath(ctx, p.x, p.y, ir * 0.3); ctx.stroke();
        ellipse(ctx, p.x - ir * 0.32, p.y - ir * 0.38, ir * 0.22, ir * 0.12, 'rgba(255,255,255,0.65)');
        sparkle(ctx, p.x + ir * 0.45, p.y - ir * 0.45, s * 0.14 * pulse, '#ffffff');
      }
      return;
    }

    // nursery
    ctx.fillStyle = '#fff1d6';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,160,70,0.5)';
    ctx.lineWidth = 1;
    hexPath(ctx, p.x, p.y, ir * 0.7); ctx.stroke();
    if (!c.egg) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(200,130,60,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.2, s * 0.27, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      const has = Object.values(state.inventory.eggs).some((n) => n > 0);
      if (has) {
        ctx.fillStyle = '#e08a2a';
        ctx.font = `800 ${s * 0.36}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', p.x, p.y + 1);
      }
      return;
    }
    const st = eggStatus(c.egg, now);
    const es = s * 0.3;
    if (st.stage === 'egg') {
      drawEgg(ctx, p.x, p.y, es, c.egg.kind, t, 0.03);
    } else if (st.stage === 'larva') {
      ellipse(ctx, p.x, p.y + es * 0.2, es * 0.95, es * 0.5, 'rgba(255,214,140,0.6)');
      ctx.strokeStyle = '#fffaf0';
      ctx.lineWidth = es * 0.45;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(p.x, p.y, es * 0.45, 0.4 + Math.sin(t * 2) * 0.1, 5.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,180,140,0.6)';
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 4; k++) {
        const a = 1 + k * 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * es * 0.25, p.y + Math.sin(a) * es * 0.25);
        ctx.lineTo(p.x + Math.cos(a) * es * 0.67, p.y + Math.sin(a) * es * 0.67);
        ctx.stroke();
      }
      ellipse(ctx, p.x + es * 0.38, p.y - es * 0.15, es * 0.06, es * 0.06, '#5c4033');
    } else if (st.stage === 'pupa') {
      hexPath(ctx, p.x, p.y, ir * 0.82);
      ctx.fillStyle = '#f5d9a6';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,140,70,0.5)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(160,100,40,0.7)';
      ctx.font = `700 ${s * 0.22}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const z = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - z;
      ctx.fillText('z', p.x + s * 0.12 + z * 6, p.y - s * 0.05 - z * 10);
      ctx.globalAlpha = 1;
      ctx.fillText('z', p.x - s * 0.08, p.y + s * 0.1);
    } else {
      const bounce = Math.abs(Math.sin(t * 5)) * s * 0.08;
      hexPath(ctx, p.x, p.y, ir * 0.95);
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 4)})`;
      ctx.fill();
      hexPath(ctx, p.x, p.y, ir * 0.82);
      ctx.fillStyle = '#fff8e6';
      ctx.fill();
      drawEgg(ctx, p.x, p.y - bounce, es * 1.05, c.egg.kind, t, 0.18);
      sparkle(ctx, p.x + s * 0.32, p.y - s * 0.3, s * 0.12 * (0.5 + 0.5 * Math.sin(t * 6)), '#fff');
      sparkle(ctx, p.x - s * 0.34, p.y + s * 0.1, s * 0.1 * (0.5 + 0.5 * Math.cos(t * 6)), '#fff');
    }
    if (!st.ready) {
      // hatch progress ring
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, ir * 0.78, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#8fd18b';
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(p.x, p.y, ir * 0.78, -Math.PI / 2, -Math.PI / 2 + st.progress * Math.PI * 2); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // ------------------------------------------------------------ input
  tap(sx, sy) {
    let best = null; let bd = this.size * 0.42;
    for (const c of this.crawlers) {
      const d = Math.hypot(c.x - sx, c.y - sy);
      if (d < bd) { bd = d; best = c; }
    }
    const idx = this.cellAt(sx, sy);
    const cell = idx >= 0 ? state.cells[idx] : null;
    // anything the player can act on wins over petting a bee that wanders past
    const cellBusy = cell && (
      (cell.type === 'honey' && cell.fill >= CELL_CAPACITY)
      || (cell.type === 'nursery' && (!cell.egg || eggStatus(cell.egg).ready))
      || (cell.type === 'locked' && cellNeighborsOpen(idx)));
    if (best && !cellBusy) {
      best.happy = 1; best.buzz = 1.2; best.wait = Math.max(best.wait, 1);
      this.fx.text(best.x, best.y - this.size * 0.45, `${best.name} 💛`, '#d9577b');
      this.fx.burst(best.x, best.y - 6, 'heart', 3);
      this.hooks.sound('buzz');
      this.hooks.beeTapped(best.id);
      return;
    }
    if (!cell) return;
    this.pulse[idx] = this.time;
    const p = this.cellPos(cell);
    if (cell.type === 'queen') { this.hooks.sound('tick'); this.hooks.queenTapped(); return; }
    if (cell.type === 'locked') {
      if (cellNeighborsOpen(idx)) this.hooks.unlockPrompt(idx);
      else this.fx.text(p.x, p.y, 'Unlock a cell next to it first', '#fff3d6', 13);
      return;
    }
    if (cell.type === 'honey') {
      if (cell.fill >= CELL_CAPACITY) {
        const n = harvestCell(idx);
        this.harvestFx(p, n);
        this.hooks.changed();
      } else {
        this.fx.text(p.x, p.y - this.size * 0.2, `${Math.floor((cell.fill / CELL_CAPACITY) * 100)}% full`, '#8a4b0f', 14);
        this.hooks.sound('tick');
      }
      return;
    }
    // nursery
    if (!cell.egg) { this.hooks.eggPrompt(idx); return; }
    const st = eggStatus(cell.egg);
    if (st.ready) { this.hooks.hatch(idx); return; }
    const label = { egg: 'Egg', larva: 'Larva', pupa: 'Cocoon' }[st.stage];
    this.fx.text(p.x, p.y - this.size * 0.2, `${label} · ${fmt(st.remaining / 1000)}`, '#8a4b0f', 14);
    this.hooks.sound('tick');
  }

  harvestFx(p, n) {
    this.fx.text(p.x, p.y - this.size * 0.3, `+${n} honey`, '#a35a00', 17);
    this.fx.burst(p.x, p.y, 'honey', 10);
    this.fx.burst(p.x, p.y, 'sparkle', 5);
    this.hooks.sound('pop');
  }

  harvestAllFx(indices) {
    indices.forEach((i) => {
      const p = this.cellPos(state.cells[i]);
      this.pulse[i] = this.time;
      this.fx.burst(p.x, p.y, 'honey', 6);
    });
  }

  cellScreenPos(idx) { return this.cellPos(state.cells[idx]); }
}

export { honeyPerCell, EGGS };
