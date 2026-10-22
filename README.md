# 🐝 Little Bee Haven

A cosy, mobile-first beekeeping game. Grow a pastel isometric cottage garden, peek inside a warm honeycomb hive, harvest honey, open gifts from your bees, hatch eggs to collect 12 bee species, and decorate your garden. It's plain HTML, CSS and JavaScript (ES modules) with no build step and no image files: every sprite is drawn in code. It runs on GitHub Pages and can be installed on an iPhone Home Screen, where it works offline.

## How to play

| Where | What to do |
|---|---|
| 🌷 **Garden** | Bees fly between the hive and blooming flowers. Tap the **glowing pollen orbs** above flowers to collect pollen. Tap **gift boxes** to open them. Tap a bee to say hello. Drag to pan; pinch to zoom. |
| 🍯 **Hive** | Tap the hive in the garden, or the Hive tab. Nectar fills honey cells; tap **golden capped cells** to harvest honey. Tap a ready egg in a nursery cell to hatch a bee. Tap a dashed **+** cell to build a new honey or nursery cell. Tap the queen to see hive stats. |
| ✏️ **Decorate** | Pick a seed or decoration from the tray, then tap an empty tile. Tap a placed item to **Move** it or **Put away**. |
| 🛍️ **Shop** | Buy seeds and decorations with honey. Buy eggs with pollen (and honey for the rarer ones). Shop items unlock as your keeper level goes up. |
| 🐝 **Bees** | Your collection of 12 species, from Common to Legendary. Each species has traits: faster nectar, extra pollen, more frequent gifts, or a bonus to honey made while you're away. You can rename your bees. |

**The garden map** is the painting in `assets/garden-map.jpg`: meadows, a river looping round an island, and a waterfall. You can build on any grass tile, including the island, but not on the river or cliffs. Drag sideways to explore it. If you replace the picture (a higher-resolution export of the same map works best), run `python3 tools/make-map.py --keep-grid`. It keeps the current tile grid and rebuilds `js/map.js`, the list of buildable tiles. Leave out `--keep-grid` only for a map with a painted checkerboard, which the script then measures to find the grid.

**Every bee is built from three parts**: a body (its species), a set of legs and a pair of wings, drawn from the sprite sheets in `assets/bees/source/`. Each part has its own rarity, rolled when the bee hatches with the same odds as the egg, so Blossom and Royal eggs give better parts. A bee's honey output is its body's base nectar, boosted by its parts:

| Part | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Legs (12 sets) | +5% nectar | +10% | +15%, +1 pollen | +25%, +1 pollen | +35%, +2 pollen |
| Wings (6 pairs) | +10% nectar | +20% | +30% | +45% | +70% |

The Bees screen shows each of your bees with its parts and nectar per minute. To change the art, replace the sheets in `assets/bees/source/` (same layout) and run `python3 tools/make-bee-sprites.py`. It removes the backgrounds, including the painted checkerboard behind the wings, cuts out every part and records where legs and wings attach. `tools/bee-preview.html` (served locally) shows a sheet of sample bees.

**Progress saves automatically** to the device (in `localStorage`), every few seconds and whenever the app goes to the background. **While the game is closed** (up to 8 hours), honey cells keep filling, flowers keep growing, eggs keep hatching and gifts keep appearing. You get a "Welcome back" summary when you return.

## Project files

```
index.html             app shell, HUD, tab bar, iOS/PWA meta tags
manifest.webmanifest   Home Screen / install metadata
sw.js                  service worker (offline support)
css/style.css          mobile-first pastel UI, safe-area aware
js/main.js             boot, game loop, touch input (tap/pan/pinch), autosave
js/state.js            game rules, save/load, offline progression
js/data.js             bee species, flowers, decorations, eggs, tuning
js/map.js              tile grid + buildable land for the map (generated)
assets/garden-map.jpg  the garden map painting
js/art.js              procedural canvas art (bees, flowers, hive, cottage…)
js/garden.js           isometric garden scene
js/hive.js             hexagonal hive interior scene
js/ui.js               shop, bee collection, dialogs, decorate tray
js/icons.js, fx.js, audio.js   UI icons, particles, synthesized sounds
icons/                 app icons (rendered from the game art)
tests/play.test.mjs    end-to-end touch tests on an emulated iPhone
tools/                 local server; icon, map and bee-sprite generators; bee preview page
assets/bees/           bee part sprites (+ source sheets)
js/beeart.js           assembles a bee from body + legs + wings
```

## Publish on GitHub Pages

1. Push these files to the default branch (for example `main`) of `RyanHughes-RCD/Hivekeeper`. The files must stay at the **repository root**, with `index.html` at the top level.
2. On GitHub, open the repository and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
5. Wait 1–2 minutes and refresh the Pages settings page. It shows the live URL, which will be:
   **https://ryanhughes-rcd.github.io/Hivekeeper/**

All paths are relative, so the game works from the `/Hivekeeper/` sub-path. The empty `.nojekyll` file tells Pages to serve the files exactly as they are.

> GitHub Pages on a free account needs the repository to be **public**. Private-repository Pages needs a paid plan.

## Install on iPhone (Home Screen)

1. On the iPhone, open **Safari** (it must be Safari) and go to `https://ryanhughes-rcd.github.io/Hivekeeper/`.
2. Wait for the garden to appear, so the game has loaded once.
3. Tap the **Share** button: the square with an up arrow, in the bottom toolbar (or top-right on iPad).
4. Scroll down and tap **Add to Home Screen**. On iOS 17 and later it may be under **More** (•••) first.
5. Keep the name **Bee Haven** (or change it) and tap **Add**.
6. Launch **Bee Haven** from the Home Screen. It opens full-screen with no Safari bars, and it keeps working without a connection.

Notes:
- Home Screen apps and Safari keep **separate saves**. Pick one and play there.
- Sound starts after your first tap (an iOS rule). You can turn it off in ⚙︎ Settings.
- If iOS is very low on storage, it may clear website data for apps you haven't opened in weeks. Opening the game regularly keeps the save.

## Run locally

```bash
npm start                    # serves on http://localhost:8080
```

Any static server works, for example `python3 -m http.server 8080`. Open the address in a browser and use the device toolbar in dev tools to emulate a phone.

## Tests

The test suite drives the real game on an emulated **iPhone 13** with touch input. It covers collecting pollen, petting a bee, opening the hive, harvesting a honey cell, nectar filling over time, hatching an egg, building a cell, harvest-all, buying in the shop, the bee collection, planting/moving/putting away decorations, opening a gift, pan and pinch-zoom, saving across a reload, 2 hours of offline progress, loading offline through the service worker, and checking that no JavaScript errors were raised.

```bash
npm install                  # installs Playwright (dev dependency)
npx playwright install chromium
npm test
```

Screenshots from each step are saved to `test-results/`. To regenerate the app icons from the game art, run `npm run icons`.
