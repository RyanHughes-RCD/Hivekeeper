// Little Bee Haven — static game data (species, flowers, decorations, eggs, tuning).

export const SAVE_KEY = 'littlebeehaven.save.v1';
export const GRID = 7;                 // garden is GRID x GRID isometric tiles
export const HIVE_TILE = { x: 2, y: 2 };
export const HIVE_RINGS = 3;           // hex rings around the queen cell (37 cells total)
export const CELL_CAPACITY = 100;      // nectar needed to cap a honey cell
export const MAX_GIFTS = 3;
export const MAX_OFFLINE_SECONDS = 8 * 3600;
export const MAX_BEES = 30;

export const RARITY = {
  common:    { label: 'Common',    color: '#8cc084' },
  uncommon:  { label: 'Uncommon',  color: '#6fb3e0' },
  rare:      { label: 'Rare',      color: '#b689e0' },
  epic:      { label: 'Epic',      color: '#f08bb4' },
  legendary: { label: 'Legendary', color: '#f2b233' },
};

// nectar: nectar per second this bee brings home
// pollen: bonus pollen whenever you collect from a flower
// gift:   fraction shaved off the time between gifts (stacks, capped)
// sleep:  bonus to offline production (stacks, capped)
export const SPECIES = {
  honey: {
    name: 'Honey Bee', rarity: 'common', body: '#ffcf4a', stripe: '#4a3426', head: '#ffcf4a', wing: '#e8f6ff',
    nectar: 0.6, pollen: 0, gift: 0, sleep: 0,
    desc: 'A cheerful, hardworking classic. Hums little songs while she gathers nectar.',
  },
  bumble: {
    name: 'Bumble Bee', rarity: 'common', body: '#ffd35c', stripe: '#3b2e2a', head: '#3b2e2a', wing: '#e8f6ff', fluffy: true,
    nectar: 0.45, pollen: 1, gift: 0, sleep: 0,
    desc: 'Round, fuzzy and covered in pollen. Every flower visit brings back a little extra.',
  },
  clover: {
    name: 'Clover Bee', rarity: 'common', body: '#c5e88a', stripe: '#4f6b3a', head: '#c5e88a', wing: '#effff0', acc: 'leaf',
    nectar: 0.55, pollen: 0, gift: 0.04, sleep: 0,
    desc: 'Lucky little bee who sometimes finds a four-leaf clover. Gifts appear a bit more often.',
  },
  sleepy: {
    name: 'Sleepy Bee', rarity: 'uncommon', body: '#c9c3f0', stripe: '#4d4570', head: '#c9c3f0', wing: '#f0eeff', acc: 'nightcap',
    nectar: 0.5, pollen: 0, gift: 0, sleep: 0.15,
    desc: 'Works hardest in her dreams. Boosts honey made while you are away.',
  },
  mint: {
    name: 'Mint Bee', rarity: 'uncommon', body: '#a8ecd2', stripe: '#2f6b5a', head: '#a8ecd2', wing: '#eafffa',
    nectar: 0.8, pollen: 0, gift: 0, sleep: 0,
    desc: 'Fresh and zippy! Flies faster than most and fills honey cells quickly.',
  },
  lavender: {
    name: 'Lavender Bee', rarity: 'uncommon', body: '#d6b8f0', stripe: '#5b3f7a', head: '#d6b8f0', wing: '#f6eeff', acc: 'flower',
    accColor: '#b48ae6',
    nectar: 0.6, pollen: 1, gift: 0, sleep: 0.05,
    desc: 'Smells wonderful. Calms the whole hive and brings a bit of extra pollen.',
  },
  peach: {
    name: 'Peach Bee', rarity: 'rare', body: '#ffc3a0', stripe: '#8a4b3a', head: '#ffc3a0', wing: '#fff1e8', acc: 'bow',
    nectar: 1.0, pollen: 1, gift: 0, sleep: 0,
    desc: 'Sweet as summer fruit. A strong nectar gatherer with a fondness for bows.',
  },
  rose: {
    name: 'Rose Bee', rarity: 'rare', body: '#ffb3c7', stripe: '#8c3550', head: '#ffb3c7', wing: '#fff0f5', acc: 'flower',
    accColor: '#ff6f91',
    nectar: 0.8, pollen: 0, gift: 0.1, sleep: 0,
    desc: 'A romantic who loves leaving presents. Gifts appear much more often.',
  },
  sky: {
    name: 'Sky Bee', rarity: 'rare', body: '#a9d8ff', stripe: '#2f5c8a', head: '#a9d8ff', wing: '#ffffff', acc: 'sparkle',
    nectar: 1.1, pollen: 0, gift: 0.04, sleep: 0,
    desc: 'Dances on the breeze. Some say she carries a little bit of sky home every trip.',
  },
  moon: {
    name: 'Moon Bee', rarity: 'epic', body: '#e8ecff', stripe: '#3b3f6e', head: '#e8ecff', wing: '#d8e2ff', acc: 'glow',
    nectar: 1.3, pollen: 1, gift: 0, sleep: 0.3,
    desc: 'Glows softly at night. Makes a lot of honey while the garden sleeps.',
  },
  rainbow: {
    name: 'Rainbow Bee', rarity: 'epic', body: '#fff3b0', stripe: 'rainbow', head: '#fff3b0', wing: '#ffffff', acc: 'sparkle',
    nectar: 1.5, pollen: 2, gift: 0.08, sleep: 0,
    desc: 'Every stripe a different colour. Brings joy, pollen and presents wherever she flies.',
  },
  queen: {
    name: 'Royal Queen', rarity: 'legendary', body: '#ffc93c', stripe: '#6b3a1f', head: '#ffc93c', wing: '#fff8e0', acc: 'crown',
    nectar: 2.5, pollen: 2, gift: 0.1, sleep: 0.2,
    desc: 'A true queen of the haven. Her presence makes every part of the hive thrive.',
  },
};
export const SPECIES_ORDER = Object.keys(SPECIES);

export const BEE_NAMES = [
  'Pip', 'Honeydew', 'Buttercup', 'Biscuit', 'Clementine', 'Dot', 'Fizz', 'Maple', 'Nutmeg', 'Poppy',
  'Pudding', 'Sunny', 'Tink', 'Waffle', 'Bramble', 'Pebble', 'Mochi', 'Toffee', 'Willow', 'Bean',
  'Peaches', 'Juniper', 'Marigold', 'Noodle', 'Puff', 'Sprout', 'Tilly', 'Ziggy', 'Bluebell', 'Cricket',
  'Fern', 'Hazel', 'Lulu', 'Muffin', 'Olive', 'Pickle', 'Rosie', 'Sage', 'Twig', 'Wren',
];

// growS: seconds to bloom. pollenS: seconds between pollen. pollen: amount collected.
export const FLOWERS = {
  daisy:     { name: 'Daisy',          lvl: 1, cost: 6,   growS: 45,   pollenS: 40,  pollen: 2,  shape: 'daisy',     petal: '#ffffff', center: '#ffd34d', height: 12 },
  clover:    { name: 'Clover',         lvl: 1, cost: 8,   growS: 60,   pollenS: 50,  pollen: 3,  shape: 'puff',      petal: '#f7c6dc', center: '#f29bc0', height: 9 },
  tulip:     { name: 'Tulip',          lvl: 2, cost: 15,  growS: 120,  pollenS: 70,  pollen: 4,  shape: 'tulip',     petal: '#ff9fb8', center: '#ff7a9c', height: 15 },
  lavender:  { name: 'Lavender',       lvl: 2, cost: 18,  growS: 150,  pollenS: 80,  pollen: 5,  shape: 'spike',     petal: '#b79ae8', center: '#9a7bd6', height: 17 },
  forgetme:  { name: 'Forget-me-not',  lvl: 3, cost: 25,  growS: 200,  pollenS: 90,  pollen: 6,  shape: 'cluster',   petal: '#8ec9ff', center: '#ffe066', height: 10 },
  poppy:     { name: 'Poppy',          lvl: 4, cost: 35,  growS: 260,  pollenS: 110, pollen: 8,  shape: 'poppy',     petal: '#ff9a76', center: '#4a3426', height: 15 },
  bluebell:  { name: 'Bluebell',       lvl: 5, cost: 45,  growS: 320,  pollenS: 120, pollen: 9,  shape: 'bell',      petal: '#9fb2ff', center: '#7d8ff0', height: 14 },
  rose:      { name: 'Rose',           lvl: 6, cost: 70,  growS: 420,  pollenS: 150, pollen: 12, shape: 'rose',      petal: '#ff8fab', center: '#e8607f', height: 15 },
  sunflower: { name: 'Sunflower',      lvl: 7, cost: 100, growS: 600,  pollenS: 180, pollen: 16, shape: 'sunflower', petal: '#ffd23f', center: '#8a5a2b', height: 26 },
};
export const FLOWER_ORDER = Object.keys(FLOWERS);

export const DECOR = {
  stones:    { name: 'Stepping Stones', desc: 'A cobbled little path for tiny feet', lvl: 1, cost: 12,  flat: true },
  mushroom:  { name: 'Toadstools', desc: 'Spotty toadstools — fairies approve',      lvl: 1, cost: 18 },
  bush:      { name: 'Round Hedge', desc: 'A plump hedge sprinkled with blossoms',     lvl: 1, cost: 20 },
  fence:     { name: 'Picket Fence', desc: 'Classic white pickets for a cottage edge',    lvl: 2, cost: 15 },
  bench:     { name: 'Garden Bench', desc: 'A sky-blue spot to watch the bees',    lvl: 2, cost: 45 },
  lantern:   { name: 'Glow Lantern', desc: 'Glows warmly as the evening falls',    lvl: 3, cost: 40 },
  gnome:     { name: 'Garden Gnome', desc: 'Keeps a watchful eye on the flowers',    lvl: 3, cost: 55 },
  birdbath:  { name: 'Bird Bath', desc: 'Little birds stop by for a splash',       lvl: 4, cost: 80 },
  pond:      { name: 'Lily Pond', desc: 'Lily pads, ripples and quiet calm',       lvl: 4, cost: 110, flat: true },
  birdhouse: { name: 'Birdhouse', desc: 'A cosy home for a songbird family',       lvl: 5, cost: 90 },
  arch:      { name: 'Rose Arch', desc: 'Climbing roses over a white arch',       lvl: 6, cost: 160 },
  tree:      { name: 'Cherry Tree', desc: 'Drifts pink petals across the garden',     lvl: 7, cost: 250 },
};
export const DECOR_ORDER = Object.keys(DECOR);

// weights per rarity tier when hatching
export const EGGS = {
  common: { name: 'Meadow Egg', lvl: 1, honey: 0,   pollen: 25,  hatchS: 45,
            color: '#fff6e0', spot: '#f2d38a', weights: { common: 72, uncommon: 24, rare: 4 } },
  fancy:  { name: 'Blossom Egg', lvl: 3, honey: 120, pollen: 60, hatchS: 180,
            color: '#ffe3ef', spot: '#f5a3c4', weights: { uncommon: 50, rare: 38, epic: 12 } },
  royal:  { name: 'Royal Egg', lvl: 6, honey: 500, pollen: 180,  hatchS: 480,
            color: '#fff1b8', spot: '#f2b233', weights: { rare: 45, epic: 43, legendary: 12 } },
};
export const EGG_ORDER = Object.keys(EGGS);

export function xpForLevel(level) {
  return Math.floor(24 * Math.pow(level, 1.5));
}

export function honeyPerCell(level) {
  return 6 + level * 2;
}

export function cellUnlockCost(unlockedExtra) {
  return Math.round(40 * Math.pow(1.38, unlockedExtra));
}
