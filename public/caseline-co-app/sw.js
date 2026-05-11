// CaseLine Co-App service worker.
//
// Two jobs:
//   1. Cache the app shell so the Co-App opens instantly and works
//      offline (the user is in a courtroom basement with no cell service).
//   2. Pass through API + Firestore calls untouched so real-time sync
//      and license validation always hit the live network when online.
//
// Cache strategy:
//   - App shell (HTML, JS, CSS, icons) → cache-first with background revalidate
//   - Same-origin /api/*, /caseline-co-app/manifest.webmanifest → network-first
//   - Cross-origin (Firestore, Firebase Storage, googleapis) → never cached

const CACHE = 'caseline-co-app-v1';
const APP_SHELL = [
  '/caseline/co-app/',
  '/caseline-co-app/manifest.webmanifest',
  '/caseline-co-app/icon-192.png',
  '/caseline-co-app/icon-512.png',
  '/caseline-co-app/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firestore / Firebase Storage / Google APIs / Stripe.
  if (url.origin !== self.location.origin) return;

  // Network-first for API and Next.js data requests.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }

  // App-shell paths (under /caseline/co-app/ or /caseline-co-app/*): cache-first.
  if (url.pathname.startsWith('/caseline/co-app') || url.pathname.startsWith('/caseline-co-app/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchAndCache = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then((c) => c.put(event.request, clone)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchAndCache;
      }),
    );
    return;
  }

  // Other same-origin requests: pass through.
});
