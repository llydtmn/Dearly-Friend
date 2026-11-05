// ===== Push notifications =====
// APPEND this to the END of your existing public/sw.js. Do not replace the file.

const PUSH_ICON = '/icon-192.png'; // change to an icon that exists in /public

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
      badge: PUSH_ICON,
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
