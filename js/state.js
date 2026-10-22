// Little Bee Haven — game state, rules, persistence and offline progression.
// Everything time-based is stored as wall-clock timestamps so it keeps
// progressing while the game is closed.
import {
  SAVE_KEY, GRID, HIVE_TILE, HIVE_RINGS, CELL_CAPACITY, MAX_GIFTS, MAX_OFFLINE_SECONDS, MAX_BEES,
  SPECIES, SPECIES_ORDER, BEE_NAMES, FLOWERS, DECOR, EGGS, xpForLevel, honeyPerCell, cellUnlockCost,
} from './data.js';

// ---------- tiny event bus (UI listens for toasts, floating text, sounds) ----------
const listeners = {};
export const bus = {
  on(evt, fn) { (listeners[evt] ||= []).push(fn); },
  emit(evt, data) { (listeners[evt] || []).forEach((fn) => fn(data)); },
};

export let state = null;
let uid = 1;
const nextId = () => `${Date.now().toString(36)}${(uid++).toString(36)}`;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- hex layout for the hive ----------
export const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export function hexLayout(rings = HIVE_RINGS) {
  const out = [{ q: 0, r: 0, ring: 0 }];
  for (let k = 1; k <= rings; k++) {
    let q = HEX_DIRS[4][0] * k, r = HEX_DIRS[4][1] * k;
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < k; step++) {
        out.push({ q, r, ring: k });
        q += HEX_DIRS[side][0]; r += HEX_DIRS[side][1];
      }
    }
  }
  return out;
}

// ---------- new game ----------
export function newGame(now = Date.now()) {
  const cells = hexLayout().map(({ q, r, ring }, i) => {
    let type = 'locked';
    if (ring === 0) type = 'queen';
    else if (ring === 1) type = (i === 3 || i === 6) ? 'nursery' : 'honey';
    return { q, r, type, fill: 0, egg: null };
  });
  // a little head start: one cell nearly full, one already capped, one egg on the way
  cells[1].fill = CELL_CAPACITY;
  cells[2].fill = CELL_CAPACITY * 0.6;
  cells[3].egg = { kind: 'common', start: now, dur: 30 * 1000, species: 'clover' };

  const s = {
    v: 1,
    created: now,
    lastSaved: now,
    honey: 30,
    pollen: 15,
    xp: 0,
    level: 1,
    bees: [],
    discovered: {},
    cells,
    tiles: {},
    gifts: [],
    nextGiftAt: now + 50 * 1000,
    inventory: { seeds: { daisy: 2, clover: 1 }, decor: { stones: 1 }, eggs: {} },
    stats: { honeyHarvested: 0, pollenCollected: 0, giftsOpened: 0, beesHatched: 0, cellsHarvested: 0 },
    settings: { sound: true },
    tutorial: { hive: false, garden: false },
  };
  addBee(s, 'honey', 'Pip');
  addBee(s, 'honey', 'Buttercup');
  addBee(s, 'bumble', 'Biscuit');

  const bloomed = (type, extraS = 0) => {
    const f = FLOWERS[type];
    const planted = now - (f.growS + 5) * 1000;
    return { kind: 'flower', type, planted, pollenAt: now + extraS * 1000 };
  };
  s.tiles['1,4'] = bloomed('daisy', 0);
  s.tiles['4,1'] = bloomed('daisy', 8);
  s.tiles['3,4'] = bloomed('daisy', 20);
  s.tiles['4,3'] = bloomed('clover', 3);
  s.tiles['5,2'] = bloomed('lavender', 30);
  s.tiles['0,3'] = bloomed('tulip', 15);
  s.tiles['5,5'] = { kind: 'decor', type: 'bench' };
  s.tiles['0,6'] = { kind: 'decor', type: 'bush' };
  s.tiles['6,0'] = { kind: 'decor', type: 'mushroom' };
  s.tiles['2,3'] = { kind: 'decor', type: 'stones' };
  s.tiles['6,6'] = { kind: 'decor', type: 'lantern' };
  return s;
}

function addBee(s, species, name) {
  const bee = { id: nextId(), species, name: name || pick(BEE_NAMES), born: Date.now() };
  s.bees.push(bee);
  s.discovered[species] = (s.discovered[species] || 0) + 1;
  return bee;
}

// ---------- persistence ----------
export function load(now = Date.now()) {
  let saved = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) { saved = null; }
  if (saved && saved.v === 1 && Array.isArray(saved.cells)) {
    state = migrate(saved);
    const summary = catchUp(now);
    return { fresh: false, summary };
  }
  state = newGame(now);
  return { fresh: true, summary: null };
}

function migrate(s) {
  const base = newGame(s.created || Date.now());
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.inventory.seeds ||= {}; s.inventory.decor ||= {}; s.inventory.eggs ||= {};
  s.settings ||= { sound: true };
  s.tutorial ||= { hive: true, garden: true };
  return s;
}

export function save(now = Date.now()) {
  if (!state) return false;
  state.lastSaved = now;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  state = newGame();
  save();
}

// ---------- derived values ----------
export const tileKey = (x, y) => `${x},${y}`;
export const isHiveTile = (x, y) => x === HIVE_TILE.x && y === HIVE_TILE.y;
export const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;

export function flowerStatus(tile, now = Date.now()) {
  const f = FLOWERS[tile.type];
  const p = Math.min(1, (now - tile.planted) / (f.growS * 1000));
  const stage = p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.25 ? 1 : 0;
  const bloomed = stage === 3;
  return { progress: p, stage, bloomed, ready: bloomed && now >= tile.pollenAt };
}

export function bloomedFlowers(now = Date.now()) {
  const out = [];
  for (const [k, t] of Object.entries(state.tiles)) {
    if (t.kind === 'flower' && flowerStatus(t, now).bloomed) {
      const [x, y] = k.split(',').map(Number);
      out.push({ x, y, tile: t });
    }
  }
  return out;
}

const sumTrait = (trait) => state.bees.reduce((acc, b) => acc + (SPECIES[b.species][trait] || 0), 0);
export const flowerBonus = (now = Date.now()) => Math.min(1.5, bloomedFlowers(now).length * 0.08);
export const nectarRate = (now = Date.now()) => sumTrait('nectar') * (1 + flowerBonus(now));
export const pollenBonus = () => Math.min(12, sumTrait('pollen'));
export const giftBonus = () => Math.min(0.5, sumTrait('gift'));
export const sleepBonus = () => Math.min(0.75, sumTrait('sleep'));

export function eggStatus(egg, now = Date.now()) {
  const p = Math.min(1, (now - egg.start) / egg.dur);
  const stage = p >= 1 ? 'ready' : p >= 0.66 ? 'pupa' : p >= 0.33 ? 'larva' : 'egg';
  return { progress: p, stage, ready: p >= 1, remaining: Math.max(0, egg.dur - (now - egg.start)) };
}

export function cellNeighborsOpen(idx) {
  const c = state.cells[idx];
  return HEX_DIRS.some(([dq, dr]) => {
    const n = state.cells.find((o) => o.q === c.q + dq && o.r === c.r + dr);
    return n && n.type !== 'locked';
  });
}
export function unlockedExtraCount() {
  return state.cells.filter((c) => c.type !== 'locked').length - 7;
}
export const nextCellCost = () => cellUnlockCost(Math.max(0, unlockedExtraCount()));

// ---------- simulation ----------
// Pour nectar into honey cells one at a time so the player sees them fill up.
export function produce(seconds, now = Date.now()) {
  let nectar = nectarRate(now) * seconds;
  let capped = 0;
  for (const c of state.cells) {
    if (nectar <= 0) break;
    if (c.type !== 'honey' || c.fill >= CELL_CAPACITY) continue;
    const take = Math.min(nectar, CELL_CAPACITY - c.fill);
    c.fill += take;
    nectar -= take;
    if (c.fill >= CELL_CAPACITY - 1e-6) { c.fill = CELL_CAPACITY; capped++; }
  }
  return capped;
}

function scheduleGift(from) {
  const base = 210 * (1 - giftBonus());
  state.nextGiftAt = from + rand(base * 0.7, base * 1.3) * 1000;
}

function freeGrassTiles() {
  const free = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (isHiveTile(x, y) || state.tiles[tileKey(x, y)]) continue;
      if (state.gifts.some((g) => g.x === x && g.y === y)) continue;
      free.push({ x, y });
    }
  }
  return free;
}

function spawnGifts(now) {
  let spawned = 0;
  let guard = 0;
  while (now >= state.nextGiftAt && guard++ < MAX_GIFTS + 1) {
    if (state.gifts.length >= MAX_GIFTS) { scheduleGift(now); break; }
    const free = freeGrassTiles();
    if (!free.length) { scheduleGift(now); break; }
    const spot = pick(free);
    state.gifts.push({ id: nextId(), x: spot.x, y: spot.y, t: now });
    spawned++;
    bus.emit('gift-spawn', spot);
    scheduleGift(state.nextGiftAt);
  }
  if (now >= state.nextGiftAt) scheduleGift(now);
  return spawned;
}

export function tick(dt, now = Date.now()) {
  const capped = produce(dt, now);
  if (capped) bus.emit('cell-capped', capped);
  spawnGifts(now);
}

// Run when the game opens (or returns from background) to apply time away.
export function catchUp(now = Date.now(), from = state.lastSaved) {
  const awayS = Math.max(0, (now - from) / 1000);
  if (awayS < 20) return null;
  const effective = Math.min(awayS, MAX_OFFLINE_SECONDS) * (1 + sleepBonus());
  const fillBefore = state.cells.reduce((a, c) => a + (c.type === 'honey' ? c.fill : 0), 0);
  const capped = produce(effective, now);
  const fillAfter = state.cells.reduce((a, c) => a + (c.type === 'honey' ? c.fill : 0), 0);
  const gifts = spawnGifts(now);
  const pollenReady = Object.values(state.tiles).filter((t) => t.kind === 'flower' && flowerStatus(t, now).ready).length;
  const eggsReady = state.cells.filter((c) => c.egg && eggStatus(c.egg, now).ready).length;
  const cappedTotal = state.cells.filter((c) => c.type === 'honey' && c.fill >= CELL_CAPACITY).length;
  return {
    awayS, nectar: Math.round(fillAfter - fillBefore), capped, cappedTotal, gifts, pollenReady, eggsReady,
    sleepy: sleepBonus() > 0,
  };
}

// ---------- player actions ----------
export function addXp(n) {
  state.xp += n;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level++;
    const reward = 15 * state.level;
    state.honey += reward;
    bus.emit('levelup', { level: state.level, reward });
  }
}

export function harvestCell(idx) {
  const c = state.cells[idx];
  if (!c || c.type !== 'honey' || c.fill < CELL_CAPACITY) return 0;
  const amount = honeyPerCell(state.level);
  c.fill = 0;
  state.honey += amount;
  state.stats.honeyHarvested += amount;
  state.stats.cellsHarvested++;
  addXp(3);
  return amount;
}

export function harvestAll() {
  let total = 0;
  state.cells.forEach((c, i) => { total += harvestCell(i); });
  return total;
}

export function collectPollen(x, y, now = Date.now()) {
  const t = state.tiles[tileKey(x, y)];
  if (!t || t.kind !== 'flower' || !flowerStatus(t, now).ready) return 0;
  const f = FLOWERS[t.type];
  const amount = f.pollen + pollenBonus();
  t.pollenAt = now + f.pollenS * 1000;
  state.pollen += amount;
  state.stats.pollenCollected += amount;
  addXp(1);
  return amount;
}

export function collectAllPollen(now = Date.now()) {
  let total = 0;
  for (const k of Object.keys(state.tiles)) {
    const [x, y] = k.split(',').map(Number);
    total += collectPollen(x, y, now);
  }
  return total;
}

function rollGift() {
  const lvl = state.level;
  const r = Math.random();
  if (r < 0.34) return { type: 'honey', amount: Math.round(rand(12, 30) + lvl * 4) };
  if (r < 0.62) return { type: 'pollen', amount: Math.round(rand(8, 18) + lvl * 2) };
  if (r < 0.79) {
    const opts = Object.keys(FLOWERS).filter((k) => FLOWERS[k].lvl <= lvl + 1);
    return { type: 'seed', id: pick(opts), amount: Math.random() < 0.5 ? 2 : 1 };
  }
  if (r < 0.9) {
    const opts = Object.keys(DECOR).filter((k) => DECOR[k].lvl <= lvl + 2);
    return { type: 'decor', id: pick(opts), amount: 1 };
  }
  return { type: 'egg', id: Math.random() < 0.8 ? 'common' : 'fancy', amount: 1 };
}

export function openGift(id) {
  const i = state.gifts.findIndex((g) => g.id === id);
  if (i < 0) return null;
  const gift = state.gifts[i];
  state.gifts.splice(i, 1);
  const reward = rollGift();
  if (reward.type === 'honey') state.honey += reward.amount;
  else if (reward.type === 'pollen') state.pollen += reward.amount;
  else if (reward.type === 'seed') bump(state.inventory.seeds, reward.id, reward.amount);
  else if (reward.type === 'decor') bump(state.inventory.decor, reward.id, reward.amount);
  else if (reward.type === 'egg') bump(state.inventory.eggs, reward.id, reward.amount);
  state.stats.giftsOpened++;
  addXp(5);
  return { gift, reward };
}

function bump(obj, k, n) { obj[k] = (obj[k] || 0) + n; if (obj[k] <= 0) delete obj[k]; }

function rollSpecies(kind) {
  const weights = EGGS[kind].weights;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let rarity = 'common';
  for (const [k, w] of Object.entries(weights)) { roll -= w; if (roll <= 0) { rarity = k; break; } }
  return pick(SPECIES_ORDER.filter((s) => SPECIES[s].rarity === rarity));
}

export function freeNurseryIndex() {
  return state.cells.findIndex((c) => c.type === 'nursery' && !c.egg);
}

export function placeEgg(idx, kind, now = Date.now()) {
  const c = state.cells[idx];
  if (!c || c.type !== 'nursery' || c.egg || !state.inventory.eggs[kind]) return false;
  bump(state.inventory.eggs, kind, -1);
  c.egg = { kind, start: now, dur: EGGS[kind].hatchS * 1000, species: rollSpecies(kind) };
  return true;
}

export function hatch(idx, now = Date.now()) {
  const c = state.cells[idx];
  if (!c || !c.egg || !eggStatus(c.egg, now).ready) return { ok: false };
  if (state.bees.length >= MAX_BEES) return { ok: false, reason: 'full' };
  const isNew = !state.discovered[c.egg.species];
  const bee = addBee(state, c.egg.species);
  c.egg = null;
  state.stats.beesHatched++;
  addXp(10);
  return { ok: true, bee, isNew };
}

export function canAfford(honey = 0, pollen = 0) {
  return state.honey >= honey && state.pollen >= pollen;
}

export function buy(kind, id) {
  if (kind === 'seed') {
    const f = FLOWERS[id];
    if (!f || state.level < f.lvl || !canAfford(f.cost)) return false;
    state.honey -= f.cost; bump(state.inventory.seeds, id, 1); return true;
  }
  if (kind === 'decor') {
    const d = DECOR[id];
    if (!d || state.level < d.lvl || !canAfford(d.cost)) return false;
    state.honey -= d.cost; bump(state.inventory.decor, id, 1); return true;
  }
  if (kind === 'egg') {
    const e = EGGS[id];
    if (!e || state.level < e.lvl || !canAfford(e.honey, e.pollen)) return false;
    state.honey -= e.honey; state.pollen -= e.pollen; bump(state.inventory.eggs, id, 1);
    const free = freeNurseryIndex();
    if (free >= 0) placeEgg(free, id);
    return true;
  }
  return false;
}

export function unlockCell(idx, type) {
  const c = state.cells[idx];
  if (!c || c.type !== 'locked' || !cellNeighborsOpen(idx)) return false;
  const cost = nextCellCost();
  if (!canAfford(cost)) return false;
  state.honey -= cost;
  c.type = type === 'nursery' ? 'nursery' : 'honey';
  c.fill = 0;
  addXp(4);
  return true;
}

export function tileFree(x, y) {
  return inGrid(x, y) && !isHiveTile(x, y) && !state.tiles[tileKey(x, y)];
}

export function placeItem(kind, id, x, y, now = Date.now()) {
  if (!tileFree(x, y)) return false;
  if (kind === 'seed') {
    if (!state.inventory.seeds[id]) return false;
    bump(state.inventory.seeds, id, -1);
    state.tiles[tileKey(x, y)] = { kind: 'flower', type: id, planted: now, pollenAt: now + FLOWERS[id].growS * 1000 + FLOWERS[id].pollenS * 1000 };
  } else {
    if (!state.inventory.decor[id]) return false;
    bump(state.inventory.decor, id, -1);
    state.tiles[tileKey(x, y)] = { kind: 'decor', type: id };
  }
  // a gift sitting on that tile hops to the inventory-free spot
  state.gifts = state.gifts.filter((g) => !(g.x === x && g.y === y));
  addXp(2);
  return true;
}

export function moveItem(fx, fy, tx, ty) {
  const t = state.tiles[tileKey(fx, fy)];
  if (!t || !tileFree(tx, ty)) return false;
  delete state.tiles[tileKey(fx, fy)];
  state.tiles[tileKey(tx, ty)] = t;
  state.gifts = state.gifts.filter((g) => !(g.x === tx && g.y === ty));
  return true;
}

// Decorations go back to the inventory; flowers come back as a seed only if not yet planted long.
export function storeItem(x, y) {
  const t = state.tiles[tileKey(x, y)];
  if (!t) return false;
  delete state.tiles[tileKey(x, y)];
  if (t.kind === 'decor') bump(state.inventory.decor, t.type, 1);
  else bump(state.inventory.seeds, t.type, 1);
  return true;
}

export function renameBee(id, name) {
  const b = state.bees.find((o) => o.id === id);
  if (!b) return false;
  b.name = String(name).trim().slice(0, 16) || b.name;
  return true;
}

export { CELL_CAPACITY, GRID, HIVE_TILE, MAX_BEES };
