// Pokemon Card Tracker service worker.
// Strategy: network-first for pages/config (so updates land immediately),
// cache-first for images and logos (fast + offline), never cache sheet CSVs
// beyond a session fallback.
const VERSION = 'v2';  // bumped: SHELL changed (lib.js added)
const SHELL = ['./', 'index.html', 'tracker.html', 'sets.js', 'lib.js', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // images & logos: cache-first
  if (/\.(png|jpg|jpeg|webp|svg)$/.exec(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit ||
        fetch(e.request).then(res => {
          if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
          return res;
        }).catch(() => hit)));
    return;
  }

  // everything else (pages, sets.js, sheet CSVs): network-first, cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && url.origin === location.origin) {
        const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp));
      }
      return res;
    }).catch(() => caches.match(e.request)));
});
