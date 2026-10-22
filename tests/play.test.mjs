// Little Bee Haven — end-to-end interaction tests on an emulated iPhone (touch input).
// Run: npm test   (needs `npm i -D playwright` + `npx playwright install chromium` on a fresh machine)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import { serve } from '../tools/serve.mjs';

const PORT = 8097;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = new URL('../test-results/', import.meta.url);
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const failures = [];
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const server = await serve(PORT);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const S = (fn, arg) => page.evaluate(fn, arg);
const tap = (x, y) => page.touchscreen.tap(x, y);
const shot = (name) => page.screenshot({ path: new URL(`${name}.png`, SHOTS).pathname });
const closeDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('.modal.show .card [data-close]').first();
    if (!(await btn.count())) break;
    await btn.tap();
    await page.waitForTimeout(320);
  }
};
// screen position of a garden tile (optionally lifted by `lift` world px)
const tileScreen = (x, y, lift = 0) => S(([x, y, lift]) => {
  const g = window.__haven.garden;
  return g.toScreen((x - y) * 32, (x + y) * 16 - lift);
}, [x, y, lift]);
// scroll the garden so a tile is in the middle of the screen
const lookAt = (x, y) => S(([x, y]) => {
  const g = window.__haven.garden;
  g.offX = g.w / 2 - (x - y) * 32 * g.zoom;
  g.offY = g.h / 2 - (x + y) * 16 * g.zoom;
  g.clamp();
}, [x, y]);
const cellScreen = (i) => S((i) => window.__haven.hive.cellScreenPos(i), i);

console.log('Little Bee Haven — iPhone interaction tests');
await page.goto(BASE);
await page.waitForTimeout(900);

await step('first launch shows the welcome card and starts a new garden', async () => {
  assert(await page.locator('.modal.show .card').count() === 1, 'intro card missing');
  const st = await S(() => ({ bees: window.__haven.state.bees.length, honey: window.__haven.state.honey }));
  assert(st.bees === 3 && st.honey === 30, `unexpected start state ${JSON.stringify(st)}`);
  await closeDialogs();
  await shot('01-garden');
});

await step('tapping a flower with pollen collects pollen', async () => {
  const before = await S(() => window.__haven.state.pollen);
  // daisy at 1,4 starts with pollen ready
  const p = await tileScreen(1, 4, 14);
  await tap(p.x, p.y);
  await page.waitForTimeout(200);
  const after = await S(() => window.__haven.state.pollen);
  assert(after > before, `pollen ${before} -> ${after}`);
});

await step('tapping a bee in flight makes it happy', async () => {
  await page.waitForTimeout(2500);
  const pos = await S(() => {
    const g = window.__haven.garden;
    const f = g.flyers.find((b) => b.mode !== 'inside');
    return f ? { ...g.toScreen(f.x, f.y), id: f.id } : null;
  });
  assert(pos, 'no bee flying');
  await tap(pos.x, pos.y);
  const happy = await S((id) => window.__haven.garden.flyers.find((b) => b.id === id).happy, pos.id);
  assert(happy > 0, 'bee did not react');
});

await step('tapping the hive opens the hive interior', async () => {
  const p = await tileScreen(2, 2, 30);
  await tap(p.x, p.y);
  await page.waitForTimeout(700);
  assert(await S(() => document.body.dataset.scene) === 'hive', 'scene did not switch');
  await shot('02-hive');
});

await step('tapping a capped honey cell harvests honey', async () => {
  const before = await S(() => window.__haven.state.honey);
  const p = await cellScreen(1);
  await tap(p.x, p.y);
  await page.waitForTimeout(200);
  const st = await S(() => ({ honey: window.__haven.state.honey, fill: window.__haven.state.cells[1].fill }));
  assert(st.honey > before && st.fill < 5, `honey ${before} -> ${st.honey}, fill ${st.fill}`);
});

await step('honey cells fill over time from nectar', async () => {
  const f0 = await S(() => window.__haven.state.cells.filter((c) => c.type === 'honey').reduce((a, c) => a + c.fill, 0));
  await page.waitForTimeout(1500);
  const f1 = await S(() => window.__haven.state.cells.filter((c) => c.type === 'honey').reduce((a, c) => a + c.fill, 0));
  assert(f1 > f0, `nectar did not flow (${f0} -> ${f1})`);
});

await step('a ready egg hatches into a new bee with a reveal card', async () => {
  await S(() => { const c = window.__haven.state.cells[3]; c.egg.start = Date.now() - c.egg.dur - 10; });
  const before = await S(() => window.__haven.state.bees.length);
  const p = await cellScreen(3);
  await tap(p.x, p.y);
  await page.waitForTimeout(500);
  const after = await S(() => window.__haven.state.bees.length);
  assert(after === before + 1, `bees ${before} -> ${after}`);
  assert(await page.locator('.modal.show .reveal').count() === 1, 'no hatch reveal');
  await shot('03-hatch');
  await closeDialogs();
});

await step('building a new cell from a locked slot', async () => {
  await closeDialogs();
  await S(() => { window.__haven.state.honey = 500; });
  const idx = await S(() => window.__haven.state.cells.findIndex((c, i) => c.type === 'locked' && c.q === 2 && c.r === -1));
  const p = await cellScreen(idx);
  await tap(p.x, p.y);
  await page.waitForTimeout(400);
  await page.locator('.modal.show .choice[data-type="nursery"]').tap();
  await page.waitForTimeout(300);
  const type = await S((i) => window.__haven.state.cells[i].type, idx);
  assert(type === 'nursery', `cell type is ${type}`);
});

await step('harvest-all button collects every capped cell', async () => {
  await closeDialogs();
  await S(() => window.__haven.state.cells.forEach((c) => { if (c.type === 'honey') c.fill = 100; }));
  await page.waitForTimeout(600);
  const before = await S(() => window.__haven.state.honey);
  await page.locator('#btn-harvest').tap();
  await page.waitForTimeout(200);
  const st = await S(() => ({ honey: window.__haven.state.honey, capped: window.__haven.state.cells.filter((c) => c.type === 'honey' && c.fill >= 100).length }));
  assert(st.honey > before && st.capped === 0, JSON.stringify(st));
});

await step('shop: buying seeds and an egg', async () => {
  await closeDialogs();
  await page.locator('#tabbar [data-nav="shop"]').tap();
  await page.waitForTimeout(400);
  const seeds0 = await S(() => window.__haven.state.inventory.seeds.daisy || 0);
  await page.locator('.shop-list button.buy[data-id="daisy"]').tap();
  await page.waitForTimeout(150);
  assert(await S(() => window.__haven.state.inventory.seeds.daisy) === seeds0 + 1, 'seed not bought');
  await shot('04-shop');
  await page.locator('.tabs button[data-tab="eggs"]').tap();
  await S(() => { window.__haven.state.pollen = 200; });
  await page.locator('.shop-list button.buy[data-id="common"]').tap();
  await page.waitForTimeout(150);
  const eggs = await S(() => window.__haven.state.cells.filter((c) => c.egg).length);
  assert(eggs >= 1, 'egg not placed into nursery');
  await page.locator('.modal.show [data-close]').first().tap();
  await page.waitForTimeout(350);
});

await step('bee collection shows discovered species', async () => {
  await closeDialogs();
  await page.locator('#tabbar [data-nav="bees"]').tap();
  await page.waitForTimeout(400);
  const cards = await page.locator('.dex-card').count();
  const known = await page.locator('.dex-card:not(.unknown)').count();
  assert(cards === 12 && known >= 3, `cards ${cards}, known ${known}`);
  await shot('05-bees');
  await page.locator('.dex-card:not(.unknown)').first().tap();
  await page.waitForTimeout(400);
  assert(await page.locator('.species-hero').count() === 1, 'species detail missing');
  await page.locator('.modal.show [data-close]').last().tap();
  await page.waitForTimeout(300);
  await page.locator('.modal.show [data-close]').last().tap();
  await page.waitForTimeout(350);
});

await step('decorate: plant a seed, move and put away decorations', async () => {
  await closeDialogs();
  await page.locator('#tabbar [data-nav="garden"]').tap();
  await page.waitForTimeout(500);
  await page.locator('#btn-decorate').tap();
  await page.waitForTimeout(200);
  await page.locator('.tray-item[data-kind="seed"][data-id="daisy"]').tap();
  const free = await S(() => { const s = window.__haven.state; return s.tiles['3,1'] || (s.gifts.some((g) => g.x === 3 && g.y === 1)) ? null : true; });
  assert(free, 'tile 3,1 unexpectedly busy');
  let p = await tileScreen(3, 1);
  await tap(p.x, p.y);
  await page.waitForTimeout(200);
  const planted = await S(() => window.__haven.state.tiles['3,1']);
  assert(planted && planted.kind === 'flower' && planted.type === 'daisy', 'seed was not planted');
  await shot('06-decorate');
  // select the bench and move it
  await page.locator('.tray-item.sel').tap(); // deselect
  p = await tileScreen(5, 5, 8);
  await tap(p.x + 18, p.y); // the lantern in front covers the bench's middle
  await page.waitForTimeout(150);
  await page.locator('#tray-actions [data-act="move"]').tap();
  p = await tileScreen(1, 6);
  await tap(p.x, p.y);
  await page.waitForTimeout(150);
  const moved = await S(() => ({ from: window.__haven.state.tiles['5,5'], to: window.__haven.state.tiles['1,6'] }));
  assert(!moved.from && moved.to && moved.to.type === 'bench', `bench move failed ${JSON.stringify(moved)}`);
  // put it away
  p = await tileScreen(1, 6, 6);
  await tap(p.x, p.y);
  await page.waitForTimeout(150);
  await page.locator('#tray-actions [data-act="store"]').tap();
  const stored = await S(() => ({ tile: window.__haven.state.tiles['1,6'], inv: window.__haven.state.inventory.decor.bench }));
  assert(!stored.tile && stored.inv === 1, `store failed ${JSON.stringify(stored)}`);
  await page.locator('#tray-done').tap();
});

await step('map: the river is off-limits, the island across it is buildable', async () => {
  await closeDialogs();
  await S(() => { window.__haven.state.inventory.seeds.tulip = 2; });
  // a tile on the left bend of the river, and one in the middle of the island it loops around
  const spots = await S(async () => {
    const { MAP } = await import('./js/map.js');
    const land = new Set(MAP.land.map(([x, y]) => `${x},${y}`));
    return { water: land.has('8,-1') ? null : [8, -1], island: land.has('10,-8') ? [10, -8] : null };
  });
  assert(spots.island && spots.water, `could not find test tiles ${JSON.stringify(spots)}`);
  await page.locator('#btn-decorate').tap();
  await page.locator('.tray-item[data-kind="seed"][data-id="tulip"]').tap();
  // look at the river
  await lookAt(...spots.water);
  await page.waitForTimeout(200);
  await shot('09-river');
  let p = await tileScreen(...spots.water);
  await tap(p.x, p.y);
  await page.waitForTimeout(150);
  assert(!(await S((k) => window.__haven.state.tiles[k], spots.water.join(','))), 'planted in the river');
  await lookAt(...spots.island);
  p = await tileScreen(...spots.island);
  await tap(p.x, p.y);
  await page.waitForTimeout(150);
  const t = await S((k) => window.__haven.state.tiles[k], spots.island.join(','));
  assert(t && t.type === 'tulip', 'could not plant on the island');
  await page.locator('#tray-done').tap();
  await S(() => window.__haven.garden.center());
});

await step('gifts appear in the garden and open with a reward', async () => {
  await closeDialogs();
  await S(() => { window.__haven.state.gifts = []; window.__haven.state.nextGiftAt = Date.now() - 1; });
  await page.waitForTimeout(300);
  const g = await S(() => window.__haven.state.gifts[0]);
  assert(g, 'gift did not spawn');
  await lookAt(g.x, g.y);
  const p = await tileScreen(g.x, g.y, 8);
  await tap(p.x, p.y);
  await page.waitForTimeout(400);
  assert(await S(() => window.__haven.state.gifts.length) === 0, 'gift not opened');
  assert(await page.locator('.modal.show .gift-card').count() === 1, 'no reward card');
  await shot('07-gift');
  await closeDialogs();
});

await step('drag pans and pinch zooms the garden', async () => {
  await closeDialogs();
  const z0 = await S(() => ({ x: window.__haven.garden.offX, z: window.__haven.garden.zoom }));
  const cdp = await context.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await touch('touchStart', [[200, 500]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[200 - i * 12, 500]]);
  await touch('touchEnd', []);
  const z1 = await S(() => ({ x: window.__haven.garden.offX, z: window.__haven.garden.zoom }));
  assert(z1.x < z0.x, `pan did nothing (${z0.x} -> ${z1.x})`);
  // keep both fingers on open canvas, away from the floating buttons
  await touch('touchStart', [[120, 380], [200, 380]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[120 - i * 8, 380], [200 + i * 8, 380]]);
  await touch('touchEnd', []);
  const z2 = await S(() => window.__haven.garden.zoom);
  assert(z2 > z1.z, `pinch did nothing (${z1.z} -> ${z2})`);
});

await step('progress persists across a reload', async () => {
  const snap = await S(() => { window.__haven.save(); const s = window.__haven.state; return { honey: Math.floor(s.honey), bees: s.bees.length, daisy: !!s.tiles['3,1'] }; });
  await page.reload();
  await page.waitForTimeout(800);
  const back = await S(() => { const s = window.__haven.state; return { honey: Math.floor(s.honey), bees: s.bees.length, daisy: !!s.tiles['3,1'] }; });
  assert(back.bees === snap.bees && back.daisy && Math.abs(back.honey - snap.honey) <= 1, `${JSON.stringify(snap)} vs ${JSON.stringify(back)}`);
  assert(await page.locator('.modal.show .card').count() === 0, 'intro shown again on a returning visit');
});

await step('offline progression: 2 hours away fills cells and shows a welcome-back summary', async () => {
  // leave the game first (it saves on exit), then edit the save from a blank same-origin page
  await page.goto(`${BASE}__blank__`);
  await S(() => {
    const raw = JSON.parse(localStorage.getItem('littlebeehaven.save.v1'));
    raw.cells.forEach((c) => { if (c.type === 'honey') c.fill = 0; });
    raw.lastSaved = Date.now() - 2 * 3600 * 1000;
    raw.gifts = []; raw.nextGiftAt = Date.now() - 3600 * 1000;
    localStorage.setItem('littlebeehaven.save.v1', JSON.stringify(raw));
  });
  await page.goto(BASE);
  await page.waitForTimeout(900);
  const st = await S(() => ({
    capped: window.__haven.state.cells.filter((c) => c.type === 'honey' && c.fill >= 100).length,
    gifts: window.__haven.state.gifts.length,
  }));
  assert(st.capped >= 4 && st.gifts >= 1, JSON.stringify(st));
  assert(await page.locator('.modal.show .summary').count() === 1, 'welcome-back card missing');
  await shot('08-welcome-back');
  await closeDialogs();
});

await step('service worker makes the game load offline', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForTimeout(600);
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(800);
  const ok = await S(() => !!window.__haven && document.querySelectorAll('#tabbar button').length === 4);
  await context.setOffline(false);
  assert(ok, 'game did not boot offline');
});

await step('no JavaScript errors were raised', async () => {
  assert(errors.length === 0, errors.join('\n'));
});

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
