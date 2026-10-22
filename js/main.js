// Little Bee Haven — boot, game loop, scene switching, touch input and autosave.
import {
  state, bus, load, save, tick, catchUp, hatch, placeItem, moveItem, storeItem, harvestAll, collectAllPollen,
  flowerStatus, eggStatus, CELL_CAPACITY,
} from './state.js';
import { GardenScene } from './garden.js';
import { HiveScene } from './hive.js';
import { play, unlockAudio, setSoundEnabled } from './audio.js';
import * as UI from './ui.js';
import { spritesReady } from './beeart.js';

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let dpr = 1;
let W = 0; let H = 0;
let current = 'garden';
let lastFrame = performance.now();
let lastWall = Date.now();
let saveTimer = 0;
let toolsTimer = 0;
let dirty = false;

const sound = (name) => play(name);
const changed = () => { dirty = true; UI.updateHUD(); UI.renderTray(garden.selected); refreshTools(); };

// ------------------------------------------------------------ scenes
const garden = new GardenScene({
  sound,
  changed,
  gotoHive: () => setTimeout(() => switchScene('hive'), 120),
  hint: throttle((msg) => UI.toast(msg), 2500),
  giftOpened: (reward) => { UI.giftReveal(reward); UI.bumpCounter(reward.type === 'pollen' ? 'pollen' : 'honey'); },
  selectionChanged: (sel) => UI.renderTray(sel),
  place: (item, t) => {
    const ok = placeItem(item.kind, item.id, t.x, t.y);
    if (ok) changed();
    return ok;
  },
  moveTo: (from, to) => {
    const ok = moveItem(from.x, from.y, to.x, to.y);
    if (ok) changed();
    return ok;
  },
});

const hive = new HiveScene({
  sound,
  changed: () => { changed(); UI.bumpCounter('honey'); },
  beeTapped: () => {},
  queenTapped: () => UI.openHiveInfo(),
  unlockPrompt: (idx) => UI.unlockPrompt(idx),
  eggPrompt: (idx) => UI.eggPrompt(idx),
  hatch: (idx) => {
    const res = hatch(idx);
    if (!res.ok) {
      if (res.reason === 'full') UI.toast('Your hive is full of bees! 🐝');
      return;
    }
    const p = hive.cellScreenPos(idx);
    hive.fx.burst(p.x, p.y, 'confetti', 22);
    play('hatch');
    UI.hatchReveal(res);
    changed();
  },
});

const scenes = { garden, hive };

UI.initUI({
  sound,
  changed,
  settingsChanged: () => { setSoundEnabled(state.settings.sound); dirty = true; },
  reset: () => { garden.flyers = []; hive.crawlers = []; exitEdit(); switchScene('garden', true); changed(); },
  traySelect: (sel) => { garden.edit = sel; garden.selected = null; garden.moving = null; },
  trayAction: (act) => {
    if (!garden.selected) return;
    if (act === 'move') {
      garden.moving = { ...garden.selected };
      UI.toast('Tap an empty tile to move it there');
    } else if (act === 'store') {
      storeItem(garden.selected.x, garden.selected.y);
      garden.selected = null;
      play('tick');
      changed();
    }
  },
  trayDone: () => exitEdit(),
});
UI.bindTray();

function enterEdit() {
  if (current !== 'garden') switchScene('garden', true);
  garden.editMode = true;
  garden.edit = null; garden.selected = null; garden.moving = null;
  UI.openTray();
  play('tick');
}
function exitEdit() {
  garden.editMode = false;
  garden.edit = null; garden.selected = null; garden.moving = null;
  UI.closeTray();
}

// ------------------------------------------------------------ layout
function insets() {
  const hud = $('hud').getBoundingClientRect();
  const tab = $('tabbar').getBoundingClientRect();
  return { top: hud.bottom + 6, bottom: Math.max(0, H - tab.top) + 6 };
}

function resize() {
  dpr = Math.min(3, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ins = insets();
  garden.resize(W, H, ins);
  hive.resize(W, H, ins);
}

// ------------------------------------------------------------ scene switching
function switchScene(name, instant = false) {
  if (name === current) return;
  if (name !== 'garden' && garden.editMode) exitEdit();
  const fade = $('fade');
  fade.style.background = name === 'hive' ? '#ffcf6a' : '#fde2ef';
  const swap = () => {
    current = name;
    document.body.dataset.scene = name;
    document.querySelectorAll('#tabbar [data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
    const label = $('scene-label');
    label.textContent = name === 'hive' ? 'Tap golden cells to harvest honey' : '';
    label.classList.toggle('show', name === 'hive');
    refreshTools();
  };
  if (instant) { swap(); return; }
  fade.classList.add('on');
  setTimeout(() => { swap(); fade.classList.remove('on'); }, 190);
}

function refreshTools() {
  const now = Date.now();
  const capped = state.cells.filter((c) => c.type === 'honey' && c.fill >= CELL_CAPACITY).length;
  const eggs = state.cells.filter((c) => c.egg && eggStatus(c.egg, now).ready).length;
  const pollen = Object.values(state.tiles).filter((t) => t.kind === 'flower' && flowerStatus(t, now).ready).length;

  const h = $('btn-harvest');
  h.hidden = !(current === 'hive' && capped >= 2);
  h.querySelector('span').textContent = `Harvest all (${capped})`;
  const c = $('btn-collect');
  c.hidden = !(current === 'garden' && pollen >= 3);
  c.querySelector('span').textContent = `Collect all (${pollen})`;
  $('btn-decorate').hidden = current !== 'garden';

  setBadge('hive', capped + eggs);
  setBadge('garden', current === 'garden' ? 0 : state.gifts.length + pollen);
}

function setBadge(nav, n) {
  const b = document.querySelector(`#tabbar [data-nav="${nav}"] .badge`);
  b.hidden = !n;
  b.textContent = n > 9 ? '9+' : String(n);
}

// ------------------------------------------------------------ buttons
document.querySelectorAll('#tabbar [data-nav]').forEach((b) => b.addEventListener('click', () => {
  unlockAudio();
  const nav = b.dataset.nav;
  play('tick');
  if (nav === 'garden' || nav === 'hive') { UI.closeAll(); switchScene(nav); }
  if (nav === 'bees') UI.openBeedex();
  if (nav === 'shop') UI.openShop();
}));
$('btn-settings').addEventListener('click', () => { unlockAudio(); play('tick'); UI.openSettings(); });
$('btn-decorate').addEventListener('click', () => { unlockAudio(); enterEdit(); });
$('btn-harvest').addEventListener('click', () => {
  const idx = state.cells.map((c, i) => (c.type === 'honey' && c.fill >= CELL_CAPACITY ? i : -1)).filter((i) => i >= 0);
  const total = harvestAll();
  if (total) {
    hive.harvestAllFx(idx);
    hive.fx.text(W / 2, H * 0.45, `+${total} honey`, '#a35a00', 26);
    play('chime');
    UI.bumpCounter('honey');
    changed();
  }
});
$('btn-collect').addEventListener('click', () => {
  const total = collectAllPollen();
  if (total) {
    for (const k of Object.keys(state.tiles)) {
      const [x, y] = k.split(',').map(Number);
      if (state.tiles[k].kind === 'flower') garden.fx.burst((x - y) * 32, (x + y) * 16 - 26, 'pollen', 4);
    }
    garden.fx.text(0, 40, `+${total} pollen`, '#d48a00', 18);
    play('chime');
    UI.bumpCounter('pollen');
    changed();
  }
});

// ------------------------------------------------------------ touch / pointer input
const pointers = new Map();
let gesture = null;

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  canvas.setPointerCapture?.(e.pointerId);
  // a primary pointer starts a fresh gesture: forget any pointer whose 'up' got lost
  if (e.isPrimary) pointers.clear();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  if (pointers.size === 1) gesture = { moved: false, pinch: false };
  else {
    gesture = { moved: true, pinch: true, dist: pinchDist() };
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.pinch && pointers.size >= 2) {
    const d = pinchDist();
    const c = pinchCenter();
    if (current === 'garden' && gesture.dist > 0) garden.pinch(d / gesture.dist, c.x, c.y);
    gesture.dist = d;
    return;
  }
  if (!gesture.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > 10) gesture.moved = true;
  if (gesture.moved && current === 'garden') garden.pan(dx, dy);
});

function endPointer(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p || !gesture) return;
  if (pointers.size === 0) {
    const quick = performance.now() - p.t < 700;
    if (!gesture.moved && quick && e.type === 'pointerup') scenes[current].tap(e.clientX, e.clientY);
    gesture = null;
  } else if (gesture.pinch) {
    // a finger lifted after pinching: keep panning with the other without tapping
    gesture = { moved: true, pinch: false };
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (current === 'garden') garden.pinch(e.deltaY < 0 ? 1.08 : 1 / 1.08, e.clientX, e.clientY);
}, { passive: false });

function pinchDist() {
  const [a, b] = [...pointers.values()].slice(-2);
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function pinchCenter() {
  const [a, b] = [...pointers.values()].slice(-2);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// stop iOS page zoom / bounce
['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.sheet, .card, #tray-items')) e.preventDefault();
}, { passive: false });

// ------------------------------------------------------------ game events
bus.on('levelup', (d) => { play('levelup'); UI.levelUp(d); UI.bumpCounter('honey'); });
bus.on('gift-spawn', (spot) => {
  garden.fx.burst((spot.x - spot.y) * 32, (spot.x + spot.y) * 16 - 10, 'sparkle', 8);
  if (current === 'garden') play('tick');
});

// ------------------------------------------------------------ loop
function frame(ts) {
  const dt = Math.min(0.1, Math.max(0, (ts - lastFrame) / 1000));
  lastFrame = ts;
  const now = Date.now();
  const wallGap = (now - lastWall) / 1000;
  lastWall = now;
  if (wallGap > 5) {
    // the page was frozen in the background: apply the missed time
    const sum = catchUp(now, now - wallGap * 1000);
    if (!sum) tick(wallGap, now);
    else if (sum.awayS > 60) UI.welcomeBack(sum);
  } else {
    tick(dt, now);
  }

  garden.update(dt);
  hive.update(dt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scenes[current].draw(ctx, dpr);

  UI.updateHUD();
  toolsTimer += dt;
  if (toolsTimer > 0.4) { toolsTimer = 0; refreshTools(); }
  saveTimer += dt;
  if (saveTimer > 5 || (dirty && saveTimer > 1)) { saveTimer = 0; dirty = false; save(now); }
  requestAnimationFrame(frame);
}

function persistNow() { save(); lastWall = Date.now(); }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistNow();
});
window.addEventListener('pagehide', persistNow);
window.addEventListener('resize', () => requestAnimationFrame(resize));
window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(resize));

function throttle(fn, ms) {
  let last = 0;
  return (...a) => { const n = Date.now(); if (n - last > ms) { last = n; fn(...a); } };
}

// ------------------------------------------------------------ boot
const boot = load();
setSoundEnabled(state.settings.sound);
document.body.dataset.scene = 'garden';
resize();
UI.updateHUD();
refreshTools();
if (boot.fresh) save();
// show the first card once the bee sprites are in (or after a moment, whichever is first)
Promise.race([spritesReady, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(() => {
  if (boot.fresh) UI.intro();
  else if (boot.summary) UI.welcomeBack(boot.summary);
}, 300));
lastWall = Date.now();
requestAnimationFrame((ts) => { lastFrame = ts; requestAnimationFrame(frame); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// handy for debugging and automated tests
window.__haven = { get state() { return state; }, garden, hive, switchScene, save, enterEdit, exitEdit };
