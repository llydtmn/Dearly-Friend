# Dearly update: 3 setup steps

Copy `src/` and `public/` from this zip over the ones in your project (they replace the files of the same name), then do these:

## 1. Add these lines to `index.html` (inside `<head>`)

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#1a1a1a" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Dearly" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

Also make sure the viewport tag is `width=device-width, initial-scale=1, viewport-fit=cover`.

## 2. Turn on Realtime for the messages table (Supabase SQL editor)

```sql
alter publication supabase_realtime add table public.messages;
```

(Or: Database → Replication/Publications → supabase_realtime → toggle `messages`.)
Optional but recommended, so live deletes carry the full row:

```sql
alter table public.messages replica identity full;
```

Your existing RLS policies still decide which new letters each person receives.

## 3. Deploy

`git push` as usual. The service worker only registers in production builds, so test installability on the Vercel URL
(Chrome: menu → Install app. iPhone Safari: Share → Add to Home Screen).

## What changed

- `components/Toast.jsx` (new) + `main.jsx`: toast system; all `alert()` calls are gone
- `pages/Home.jsx`: realtime subscription, reply wiring, catch-up refresh when the app returns to the foreground
- `services/messageService.js`: `subscribeToMessages`
- `components/LetterContent.jsx`: Reply button (not shown on letters you sent)
- `components/ComposeMessage.jsx`: reply prefill, draft autosave, confirm-before-send
- `public/`: manifest, service worker, icons (the service worker never caches Supabase traffic)
