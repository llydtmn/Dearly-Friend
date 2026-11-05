/* Dearly service worker
 * - Caches the app shell so the app opens instantly and works offline-ish.
 * - NEVER caches Supabase / API traffic: letters are private and must always be live.
 * Bump CACHE_VERSION to force clients to drop old caches.
 */
const CACHE_VERSION = 'dearly-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/badge-96.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own origin: Supabase, fonts and other third parties go straight to the network
  if (url.origin !== self.location.origin) return;

  // Page loads: network first, fall back to the cached shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error()))
    );
    return;
  }

  // Static assets (Vite's hashed files never change): cache first, then network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

/* ===== Push notifications ===== */

const PUSH_ICON = '/icon-192.png'; // big colored icon (right side of the notification)
const PUSH_BADGE = '/badge-96.png'; // small white-on-transparent icon (status bar / next to the app name)

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Dearly', {
      body: data.body || 'You have a new letter.',
      icon: PUSH_ICON,
      badge: PUSH_BADGE,
      tag: data.tag, // the same letter never shows twice
      data: { url: data.url || '/' },
    })
  );
});

// Tapping the notification opens the letter
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mine = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (mine) {
        try {
          await mine.focus();
          await mine.navigate(url);
          return;
        } catch {
          /* fall through and open a new window */
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});