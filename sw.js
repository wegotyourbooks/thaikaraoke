// ThaiKaraoke service worker: precache everything, cache-first.
// Bump CACHE version on any asset change.
const CACHE = 'thaikaraoke-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/fsrs.js',
  './js/state.js',
  './js/data.js',
  './js/session.js',
  './js/modes.js',
  './js/audio.js',
  './js/tones.js',
  './js/coverage.js',
  './js/ui.js',
  './js/merge.js',
  './js/migrate.js',
  './js/derive.js',
  './js/rollup.js',
  './js/timer.js',
  './js/gist.js',
  './js/sync.js',
  './js/qr.js',
  './js/frames.js',
  './js/lessons.js',
  './js/screens/home.js',
  './js/screens/browse.js',
  './js/screens/stats.js',
  './js/screens/settings.js',
  './js/screens/tonegym.js',
  './js/screens/lessons.js',
  './data/microlessons.js',
  './data/frames.js',
  './data/pools.js',
  './data/minimal-pairs.js',
  ...Array.from({ length: 12 }, (_, i) => `./data/words-${String(i + 1).padStart(2, '0')}.js`),
  ...Array.from({ length: 9 }, (_, i) => `./data/phrases-${String(i + 1).padStart(2, '0')}.js`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Cache each asset independently so one missing file can't abort precaching.
      Promise.all(ASSETS.map((url) => c.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
