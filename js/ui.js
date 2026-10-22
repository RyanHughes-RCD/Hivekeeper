// Little Bee Haven — HTML overlay UI: HUD, sheets, dialogs, shop, bee collection, decorate tray.
import {
  SPECIES, SPECIES_ORDER, RARITY, FLOWERS, FLOWER_ORDER, DECOR, DECOR_ORDER, EGGS, EGG_ORDER,
  xpForLevel, honeyPerCell, MAX_BEES, MAX_OFFLINE_SECONDS,
} from './data.js';
import {
  state, buy, canAfford, nectarRate, flowerBonus, pollenBonus, giftBonus, sleepBonus, renameBee,
  freeNurseryIndex, placeEgg, unlockCell, nextCellCost, resetGame, tileKey, CELL_CAPACITY,
} from './state.js';
import { beeIcon, flowerIcon, seedIcon, decorIcon, eggIcon, honeyIcon, pollenIcon, giftIcon, img } from './icons.js';
import { fmt } from './garden.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function compact(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e5 ? 1 : 0)}k`;
  return `${(n / 1e6).toFixed(1)}M`;
}

let hooks = {};
export function initUI(h) {
  hooks = h;
  $('#hud-honey-icon').src = honeyIcon();
  $('#hud-pollen-icon').src = pollenIcon();
  // swallow any click that arrives right after a modal opened (touch ghost clicks)
  $('#modal-root').addEventListener('click', (e) => {
    if (performance.now() - lastOpen < 450) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  $('#modal-root').addEventListener('click', (e) => {
    // ignore the ghost click that follows the touch which opened the modal
    if (e.target.classList.contains('backdrop') && performance.now() - lastOpen > 450) closeTop();
  });
}

// ------------------------------------------------------------ HUD
let lastHud = '';
export function updateHUD() {
  const need = xpForLevel(state.level);
  const key = `${Math.floor(state.honey)}|${Math.floor(state.pollen)}|${state.level}|${state.xp}`;
  if (key === lastHud) return;
  lastHud = key;
  $('#hud-honey').textContent = compact(state.honey);
  $('#hud-pollen').textContent = compact(state.pollen);
  $('#hud-level').textContent = state.level;
  $('#hud-xp').style.width = `${Math.min(100, (state.xp / need) * 100)}%`;
}

export function bumpCounter(which) {
  const el = which === 'honey' ? $('#pill-honey') : $('#pill-pollen');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ------------------------------------------------------------ toasts
export function toast(msg, ms = 2200) {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  root.appendChild(el);
  while (root.children.length > 3) root.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms);
}

// ------------------------------------------------------------ modal stack
const stack = [];
let lastOpen = 0;
export const modalOpen = () => stack.length > 0;

function open(kind, html, { onClose, cls = '' } = {}) {
  lastOpen = performance.now();
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = `modal modal-${kind}`;
  wrap.innerHTML = `<div class="backdrop"></div><div class="${kind === 'sheet' ? 'sheet' : 'card'} ${cls}" role="dialog">${html}</div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const entry = { wrap, onClose };
  stack.push(entry);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(entry)));
  return { el: wrap.querySelector('.sheet, .card'), close: () => close(entry) };
}

function close(entry) {
  const i = stack.indexOf(entry);
  if (i < 0) return;
  stack.splice(i, 1);
  entry.wrap.classList.remove('show');
  setTimeout(() => entry.wrap.remove(), 260);
  entry.onClose?.();
  hooks.sound?.('tick');
}

export function closeTop() { if (stack.length) close(stack[stack.length - 1]); }
export function closeAll() { while (stack.length) close(stack[stack.length - 1]); }

function sheetHead(title, sub = '') {
  return `<div class="sheet-grip"></div><div class="sheet-head"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button class="icon-btn" data-close aria-label="Close">✕</button></div>`;
}

const costHtml = (honey, pollen) => [
  honey ? `<span class="cost">${img(honeyIcon(), 'mini')}${compact(honey)}</span>` : '',
  pollen ? `<span class="cost">${img(pollenIcon(), 'mini')}${compact(pollen)}</span>` : '',
].join('');

// ------------------------------------------------------------ shop
let shopTab = 'seeds';
export function openShop(tab) {
  if (tab) shopTab = tab;
  const m = open('sheet', `${sheetHead('Garden Shop', 'Spend honey &amp; pollen on seeds, decorations and eggs')}
    <div class="tabs" role="tablist">
      <button data-tab="seeds">🌱 Seeds</button><button data-tab="decor">🪴 Decor</button><button data-tab="eggs">🥚 Eggs</button>
    </div>
    <div class="shop-list"></div>`);
  const render = () => {
    m.el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === shopTab));
    const list = m.el.querySelector('.shop-list');
    let rows = [];
    if (shopTab === 'seeds') {
      rows = FLOWER_ORDER.map((id) => {
        const f = FLOWERS[id];
        return { kind: 'seed', id, icon: flowerIcon(id), name: `${f.name} Seeds`, info: `Blooms in ${fmt(f.growS)} · ${f.pollen} pollen every ${fmt(f.pollenS)}`, honey: f.cost, pollen: 0, lvl: f.lvl, own: state.inventory.seeds[id] || 0 };
      });
    } else if (shopTab === 'decor') {
      rows = DECOR_ORDER.map((id) => {
        const d = DECOR[id];
        return { kind: 'decor', id, icon: decorIcon(id), name: d.name, info: d.desc, honey: d.cost, pollen: 0, lvl: d.lvl, own: state.inventory.decor[id] || 0 };
      });
    } else {
      rows = EGG_ORDER.map((id) => {
        const e = EGGS[id];
        const odds = Object.entries(e.weights).map(([r, w]) => `<span style="color:${RARITY[r].color}">${RARITY[r].label} ${w}%</span>`).join(' · ');
        return { kind: 'egg', id, icon: eggIcon(id), name: e.name, info: `Hatches in ${fmt(e.hatchS)}<br>${odds}`, honey: e.honey, pollen: e.pollen, lvl: e.lvl, own: state.inventory.eggs[id] || 0 };
      });
    }
    list.innerHTML = rows.map((r) => {
      const locked = state.level < r.lvl;
      const afford = canAfford(r.honey, r.pollen);
      return `<div class="shop-row ${locked ? 'locked' : ''}">
        <div class="thumb">${img(r.icon)}</div>
        <div class="meta"><b>${r.name}</b><small>${r.info}</small>${r.own ? `<span class="owned">In tray: ${r.own}</span>` : ''}</div>
        <button class="buy ${afford && !locked ? '' : 'disabled'}" data-kind="${r.kind}" data-id="${r.id}">
          ${locked ? `🔒 Lv ${r.lvl}` : costHtml(r.honey, r.pollen)}
        </button></div>`;
    }).join('');
    if (shopTab === 'eggs') {
      list.insertAdjacentHTML('beforeend', `<p class="note">Eggs go straight into a free nursery cell in the hive. You have ${state.bees.length}/${MAX_BEES} bees.</p>`);
    }
  };
  m.el.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    shopTab = b.dataset.tab; hooks.sound?.('tick'); render();
  });
  m.el.querySelector('.shop-list').addEventListener('click', (e) => {
    const b = e.target.closest('button.buy'); if (!b) return;
    const { kind, id } = b.dataset;
    const lvl = kind === 'seed' ? FLOWERS[id].lvl : kind === 'decor' ? DECOR[id].lvl : EGGS[id].lvl;
    if (state.level < lvl) { toast(`Reach level ${lvl} to unlock`); hooks.sound?.('nope'); return; }
    const hadFree = freeNurseryIndex() >= 0;
    if (!buy(kind, id)) { toast('Not enough honey or pollen yet 🍯'); hooks.sound?.('nope'); return; }
    hooks.sound?.('buy');
    if (kind === 'egg') toast(hadFree ? `🥚 ${EGGS[id].name} placed in the nursery!` : `🥚 ${EGGS[id].name} saved — free a nursery cell to hatch it`);
    else toast(`Added to your decorate tray ✏️`);
    hooks.changed?.();
    render();
  });
  render();
}

// ------------------------------------------------------------ bee collection
export function openBeedex() {
  const found = SPECIES_ORDER.filter((s) => state.discovered[s]).length;
  const m = open('sheet', `${sheetHead('Bee Collection', `${found}/${SPECIES_ORDER.length} species found · ${state.bees.length}/${MAX_BEES} bees in your hive`)}
    <div class="dex-grid"></div>
    <div class="hive-stats">${statsHtml()}</div>`);
  const grid = m.el.querySelector('.dex-grid');
  grid.innerHTML = SPECIES_ORDER.map((id) => {
    const sp = SPECIES[id];
    const have = state.bees.filter((b) => b.species === id).length;
    const known = !!state.discovered[id];
    return `<button class="dex-card ${known ? '' : 'unknown'}" data-id="${id}" style="--rar:${RARITY[sp.rarity].color}">
      ${img(beeIcon(id, !known))}
      <b>${known ? sp.name : '???'}</b>
      <small style="color:${RARITY[sp.rarity].color}">${RARITY[sp.rarity].label}</small>
      ${have ? `<span class="count">×${have}</span>` : ''}
    </button>`;
  }).join('');
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.dex-card'); if (!b) return;
    hooks.sound?.('tick');
    if (!state.discovered[b.dataset.id]) { toast('Hatch eggs to discover this bee 🥚'); return; }
    openSpecies(b.dataset.id);
  });
}

function traitList(sp) {
  const t = [`🍯 ${(sp.nectar * 60).toFixed(0)} nectar/min`];
  if (sp.pollen) t.push(`🌼 +${sp.pollen} pollen per flower`);
  if (sp.gift) t.push(`🎁 gifts ${Math.round(sp.gift * 100)}% sooner`);
  if (sp.sleep) t.push(`🌙 +${Math.round(sp.sleep * 100)}% honey while away`);
  return t.map((x) => `<span class="trait">${x}</span>`).join('');
}

function openSpecies(id) {
  const sp = SPECIES[id];
  const mine = state.bees.filter((b) => b.species === id);
  const m = open('sheet', `${sheetHead(sp.name, `<span style="color:${RARITY[sp.rarity].color};font-weight:800">${RARITY[sp.rarity].label}</span>`)}
    <div class="species-hero">${img(beeIcon(id), 'hero')}<p>${sp.desc}</p><div class="traits">${traitList(sp)}</div></div>
    <h3 class="list-title">Your ${sp.name}s</h3>
    <div class="bee-list">${mine.map((b) => `<div class="bee-row">${img(beeIcon(id), 'mini-bee')}<span class="bee-name">${esc(b.name)}</span><button class="small" data-rename="${b.id}">Rename</button></div>`).join('') || '<p class="note">None right now.</p>'}</div>`);
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rename]'); if (!b) return;
    const bee = state.bees.find((x) => x.id === b.dataset.rename);
    const name = window.prompt('Name your bee', bee.name);
    if (name && renameBee(bee.id, name)) {
      b.parentElement.querySelector('.bee-name').textContent = bee.name;
      hooks.changed?.();
    }
  });
}

function statsHtml() {
  const perMin = nectarRate() * 60;
  const honeyCells = state.cells.filter((c) => c.type === 'honey').length;
  return `<div class="stat"><b>${perMin.toFixed(0)}</b><small>nectar / min</small></div>
    <div class="stat"><b>${honeyPerCell(state.level)}</b><small>honey / cell</small></div>
    <div class="stat"><b>+${Math.round(flowerBonus() * 100)}%</b><small>flower bonus</small></div>
    <div class="stat"><b>${honeyCells}</b><small>honey cells</small></div>
    <div class="stat"><b>+${pollenBonus()}</b><small>pollen / pick</small></div>
    <div class="stat"><b>${Math.round(giftBonus() * 100)}%</b><small>faster gifts</small></div>`;
}

export function openHiveInfo() {
  const minsToFill = (CELL_CAPACITY / Math.max(0.01, nectarRate())) / 60;
  const m = open('dialog', `<div class="card-body">
    ${img(beeIcon('queen'), 'hero')}
    <h2>Queen Mabel’s Hive</h2>
    <p>Your bees bring nectar home from blooming flowers. Each honey cell fills in about <b>${minsToFill < 1 ? '<1' : minsToFill.toFixed(1)} min</b>. More bloomed flowers = faster honey!</p>
    <div class="hive-stats">${statsHtml()}</div>
    ${sleepBonus() ? `<p class="note">🌙 Sleepy bees add +${Math.round(sleepBonus() * 100)}% to honey made while you’re away.</p>` : ''}
    <button class="primary" data-close>Lovely!</button></div>`);
  return m;
}

// ------------------------------------------------------------ hive dialogs
export function unlockPrompt(idx) {
  const cost = nextCellCost();
  const afford = state.honey >= cost;
  const m = open('dialog', `<div class="card-body">
    <h2>Build a new cell</h2>
    <p>Spend <b>${cost}</b> honey to add a cell to your comb.</p>
    <div class="choice-row">
      <button class="choice ${afford ? '' : 'disabled'}" data-type="honey"><span class="big">🍯</span><b>Honey cell</b><small>Fills with honey</small></button>
      <button class="choice ${afford ? '' : 'disabled'}" data-type="nursery"><span class="big">🥚</span><b>Nursery</b><small>Hatches eggs</small></button>
    </div>
    ${afford ? '' : `<p class="note warn">You need ${cost - Math.floor(state.honey)} more honey.</p>`}
    <button class="ghost" data-close>Not now</button></div>`);
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('.choice'); if (!b) return;
    if (unlockCell(idx, b.dataset.type)) {
      hooks.sound?.('place');
      toast(b.dataset.type === 'honey' ? '🍯 New honey cell built!' : '🥚 New nursery cell built!');
      hooks.changed?.();
      m.close();
    } else { toast('Not enough honey yet'); hooks.sound?.('nope'); }
  });
}

export function eggPrompt(idx) {
  const kinds = EGG_ORDER.filter((k) => state.inventory.eggs[k]);
  if (!kinds.length) {
    const m = open('dialog', `<div class="card-body">${img(eggIcon('common'), 'hero')}
      <h2>Empty nursery</h2><p>Buy an egg in the shop and it will be tucked in here to hatch into a new bee.</p>
      <button class="primary" data-go>Visit the shop</button><button class="ghost" data-close>Later</button></div>`);
    m.el.querySelector('[data-go]').addEventListener('click', () => { m.close(); openShop('eggs'); });
    return;
  }
  const m = open('dialog', `<div class="card-body"><h2>Place an egg</h2><div class="choice-row">
    ${kinds.map((k) => `<button class="choice" data-kind="${k}">${img(eggIcon(k), 'choice-img')}<b>${EGGS[k].name}</b><small>×${state.inventory.eggs[k]} · ${fmt(EGGS[k].hatchS)}</small></button>`).join('')}
    </div><button class="ghost" data-close>Cancel</button></div>`);
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('.choice'); if (!b) return;
    if (placeEgg(idx, b.dataset.kind)) { hooks.sound?.('place'); hooks.changed?.(); m.close(); }
  });
}

export function hatchReveal(res) {
  const sp = SPECIES[res.bee.species];
  const rar = RARITY[sp.rarity];
  const m = open('dialog', `<div class="card-body reveal" style="--rar:${rar.color}">
    <div class="rays"></div>
    ${res.isNew ? '<span class="badge-new">New species!</span>' : ''}
    ${img(beeIcon(res.bee.species), 'hero pop')}
    <h2>${esc(res.bee.name)} hatched!</h2>
    <p class="rarity" style="color:${rar.color}">${rar.label} ${sp.name}</p>
    <p>${sp.desc}</p>
    <div class="traits">${traitList(sp)}</div>
    <button class="primary" data-close>Welcome, ${esc(res.bee.name)}!</button>
    <button class="ghost" data-rename>Rename</button></div>`, { cls: 'reveal-card' });
  m.el.querySelector('[data-rename]').addEventListener('click', () => {
    const name = window.prompt('Name your bee', res.bee.name);
    if (name && renameBee(res.bee.id, name)) {
      m.el.querySelector('h2').textContent = `${res.bee.name} hatched!`;
      m.el.querySelector('[data-close]').textContent = `Welcome, ${res.bee.name}!`;
      hooks.changed?.();
    }
  });
}

export function giftReveal(reward) {
  let icon, text;
  if (reward.type === 'honey') { icon = honeyIcon(); text = `${reward.amount} honey`; }
  else if (reward.type === 'pollen') { icon = pollenIcon(); text = `${reward.amount} pollen`; }
  else if (reward.type === 'seed') { icon = seedIcon(reward.id); text = `${reward.amount}× ${FLOWERS[reward.id].name} seeds`; }
  else if (reward.type === 'decor') { icon = decorIcon(reward.id); text = `${DECOR[reward.id].name}`; }
  else { icon = eggIcon(reward.id); text = `${EGGS[reward.id].name}`; }
  const where = { seed: 'It’s in your decorate tray ✏️', decor: 'It’s in your decorate tray ✏️', egg: 'Tap an empty nursery cell in the hive to place it.' }[reward.type] || '';
  open('dialog', `<div class="card-body gift-card">
    ${img(giftIcon(), 'gift-open')}
    <p class="from">A bee left you a present!</p>
    <div class="reward">${img(icon, 'reward-img pop')}<b>${text}</b></div>
    ${where ? `<p class="note">${where}</p>` : ''}
    <button class="primary" data-close>Thank you, bees!</button></div>`);
}

export function levelUp({ level, reward }) {
  const unlocked = [
    ...FLOWER_ORDER.filter((k) => FLOWERS[k].lvl === level).map((k) => FLOWERS[k].name),
    ...DECOR_ORDER.filter((k) => DECOR[k].lvl === level).map((k) => DECOR[k].name),
    ...EGG_ORDER.filter((k) => EGGS[k].lvl === level).map((k) => EGGS[k].name),
  ];
  open('dialog', `<div class="card-body levelup">
    <div class="level-badge">${level}</div>
    <h2>Level up!</h2>
    <p>Your haven is blooming. Here’s <b>${reward}</b> honey as a thank-you.</p>
    ${unlocked.length ? `<p class="note">New in the shop: <b>${unlocked.join(', ')}</b></p>` : ''}
    <button class="primary" data-close>Hooray!</button></div>`);
}

export function welcomeBack(sum) {
  const lines = [];
  if (sum.nectar > 0) lines.push(`🍯 Your bees gathered <b>${compact(sum.nectar)}</b> nectar`);
  if (sum.cappedTotal) lines.push(`✨ <b>${sum.cappedTotal}</b> honey cell${sum.cappedTotal > 1 ? 's are' : ' is'} ready to harvest`);
  if (sum.pollenReady) lines.push(`🌼 <b>${sum.pollenReady}</b> flower${sum.pollenReady > 1 ? 's have' : ' has'} pollen`);
  if (sum.gifts) lines.push(`🎁 <b>${sum.gifts}</b> new gift${sum.gifts > 1 ? 's' : ''} in the garden`);
  if (sum.eggsReady) lines.push(`🥚 <b>${sum.eggsReady}</b> egg${sum.eggsReady > 1 ? 's are' : ' is'} ready to hatch`);
  if (!lines.length) lines.push('🐝 Your bees kept everything cosy');
  const capped = sum.awayS > MAX_OFFLINE_SECONDS ? `<p class="note">Bees work for up to ${MAX_OFFLINE_SECONDS / 3600} hours while you’re away.</p>` : '';
  open('dialog', `<div class="card-body">
    ${img(beeIcon('sleepy'), 'hero')}
    <h2>Welcome back!</h2>
    <p class="sub">You were away for ${fmt(sum.awayS)}</p>
    <ul class="summary">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    ${sum.sleepy ? '<p class="note">🌙 Sleepy bees boosted your offline honey.</p>' : ''}
    ${capped}
    <button class="primary" data-close>Let’s go!</button></div>`);
}

export function intro() {
  open('dialog', `<div class="card-body">
    ${img(beeIcon('honey'), 'hero pop')}
    <h2>Welcome to Little Bee Haven</h2>
    <ul class="summary">
      <li>🌼 Tap glowing <b>pollen</b> above flowers to collect it</li>
      <li>🏡 Tap the <b>hive</b> to peek inside &amp; harvest golden honey cells</li>
      <li>🎁 Bees leave <b>gifts</b> in the garden — tap to open</li>
      <li>🥚 Buy eggs to hatch <b>new bees</b> and fill your collection</li>
      <li>✏️ Plant seeds &amp; decorate with the <b>Decorate</b> button</li>
    </ul>
    <p class="note">Your haven keeps growing even when the app is closed.</p>
    <button class="primary" data-close>Start beekeeping!</button></div>`);
}

export function openSettings() {
  const s = state.stats;
  const m = open('sheet', `${sheetHead('Settings', 'Little Bee Haven')}
    <label class="toggle"><span>🔊 Sound effects</span><input type="checkbox" id="opt-sound" ${state.settings.sound ? 'checked' : ''}><i></i></label>
    <div class="hive-stats">
      <div class="stat"><b>${compact(s.honeyHarvested)}</b><small>honey harvested</small></div>
      <div class="stat"><b>${compact(s.pollenCollected)}</b><small>pollen collected</small></div>
      <div class="stat"><b>${s.giftsOpened}</b><small>gifts opened</small></div>
      <div class="stat"><b>${s.beesHatched}</b><small>bees hatched</small></div>
      <div class="stat"><b>${s.cellsHarvested}</b><small>cells harvested</small></div>
      <div class="stat"><b>${fmt((Date.now() - state.created) / 1000)}</b><small>haven age</small></div>
    </div>
    <button class="ghost" data-help>How to play</button>
    <p class="note">Your progress saves automatically on this device.</p>
    <button class="danger" data-reset>Start a new garden</button>`);
  m.el.querySelector('#opt-sound').addEventListener('change', (e) => { state.settings.sound = e.target.checked; hooks.settingsChanged?.(); });
  m.el.querySelector('[data-help]').addEventListener('click', () => intro());
  m.el.querySelector('[data-reset]').addEventListener('click', () => {
    if (window.confirm('Start over? Your bees, garden and honey will be gone forever.')) {
      resetGame();
      closeAll();
      hooks.reset?.();
      toast('A fresh new garden 🌱');
    }
  });
}

// ------------------------------------------------------------ decorate tray
let traySel = null;
export function openTray() {
  $('#tray').hidden = false;
  document.body.classList.add('editing');
  renderTray();
}
export function closeTray() {
  $('#tray').hidden = true;
  document.body.classList.remove('editing');
  traySel = null;
}

export function renderTray(selected = null) {
  const tray = $('#tray');
  if (tray.hidden) return;
  const items = [
    ...Object.entries(state.inventory.seeds).filter(([, n]) => n > 0).map(([id, n]) => ({ kind: 'seed', id, n, icon: seedIcon(id), name: FLOWERS[id].name })),
    ...Object.entries(state.inventory.decor).filter(([, n]) => n > 0).map(([id, n]) => ({ kind: 'decor', id, n, icon: decorIcon(id), name: DECOR[id].name })),
  ];
  if (traySel && !items.some((i) => i.kind === traySel.kind && i.id === traySel.id)) { traySel = null; hooks.traySelect?.(null); }
  const sel = selected && state.tiles[tileKey(selected.x, selected.y)];
  $('#tray-actions').innerHTML = sel
    ? `<span class="tray-hint">${sel.kind === 'flower' ? FLOWERS[sel.type].name : DECOR[sel.type].name} selected</span>
       <button class="pill-btn" data-act="move">↔ Move</button><button class="pill-btn" data-act="store">📦 Put away</button>`
    : `<span class="tray-hint">${traySel ? 'Tap an empty tile to place it' : items.length ? 'Choose an item, or tap something in the garden to move it' : 'Your tray is empty — visit the Shop!'}</span>`;
  $('#tray-items').innerHTML = items.map((i) => `<button class="tray-item ${traySel && traySel.kind === i.kind && traySel.id === i.id ? 'sel' : ''}" data-kind="${i.kind}" data-id="${i.id}" aria-label="${i.name}">
      ${img(i.icon)}<span class="n">${i.n}</span><small>${i.name}</small></button>`).join('')
    || '<button class="tray-item shop-link" data-shop>🛍️<small>Shop</small></button>';
}

export function bindTray() {
  $('#tray-items').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.shop !== undefined) { openShop('seeds'); return; }
    const pickd = { kind: b.dataset.kind, id: b.dataset.id };
    traySel = traySel && traySel.kind === pickd.kind && traySel.id === pickd.id ? null : pickd;
    hooks.sound?.('tick');
    hooks.traySelect?.(traySel);
    renderTray();
  });
  $('#tray-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    hooks.trayAction?.(b.dataset.act);
  });
  $('#tray-done').addEventListener('click', () => hooks.trayDone?.());
}

export function getTraySel() { return traySel; }
