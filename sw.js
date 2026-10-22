// Little Bee Haven — offline support. Caches the app shell so the game opens
// without a connection once it has been loaded once.
const CACHE = 'bee-haven-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/state.js',
  './js/data.js',
  './js/art.js',
  './js/map.js',
  './js/beeart.js',
  './js/bee-sprites.js',
  './assets/garden-map.jpg',
  './assets/bees/body-bumble.png',
  './assets/bees/body-clover.png',
  './assets/bees/body-honey.png',
  './assets/bees/body-lavender.png',
  './assets/bees/body-mint.png',
  './assets/bees/body-moon.png',
  './assets/bees/body-peach.png',
  './assets/bees/body-queen.png',
  './assets/bees/body-rainbow.png',
  './assets/bees/body-rose.png',
  './assets/bees/body-sky.png',
  './assets/bees/body-sleepy.png',
  './assets/bees/legs-0.png',
  './assets/bees/legs-1.png',
  './assets/bees/legs-10.png',
  './assets/bees/legs-11.png',
  './assets/bees/legs-2.png',
  './assets/bees/legs-3.png',
  './assets/bees/legs-4.png',
  './assets/bees/legs-5.png',
  './assets/bees/legs-6.png',
  './assets/bees/legs-7.png',
  './assets/bees/legs-8.png',
  './assets/bees/legs-9.png',
  './assets/bees/wings-0.png',
  './assets/bees/wings-1.png',
  './assets/bees/wings-2.png',
  './assets/bees/wings-3.png',
  './assets/bees/wings-4.png',
  './assets/bees/wings-5.png',
  './js/fx.js',
  './js/garden.js',
  './js/hive.js',
  './js/ui.js',
  './js/icons.js',
  './js/audio.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first (so updates show up right away), falling back to the cache offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
