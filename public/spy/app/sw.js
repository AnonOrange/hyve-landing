/* Hyve Spy PWA — minimal app-shell cache */
const CACHE = 'hyve-spy-shell-v4';
const SHELL = [
  '/spy/app/manifest.json',
  '/spy-logo/hyve-spy-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept API or third-party scanner traffic.
  if (
    url.hostname.includes('hyve-api.vercel.app') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first for navigation / HTML documents — the app shell evolves
  // (new tabs, new routes), and stale HTML hides those changes from users.
  // Falls back to cached document if offline.
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation && url.origin === location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response('Offline', { status: 503 }))),
    );
    return;
  }

  // Cache-first for shell assets we precached.
  if (SHELL.some((p) => url.pathname.endsWith(p))) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })),
    );
    return;
  }

  // Stale-while-revalidate for other same-origin static (JS/CSS/images).
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => hit);
        return hit || fetchPromise;
      }),
    );
  }
});
