import { supabase } from '../supabaseClient';
import { sendMessage, scheduleLetter, voiceExt, removeAttachments, removeVoice } from './messageService';

/**
 * Offline outbox.
 * Letters written without a connection are saved in IndexedDB (it can hold photos and voice
 * recordings, localStorage can't) and sent automatically once the connection is back.
 *
 * Retries are safe: every letter gets its message ids and file paths up front, and a
 * "duplicate" answer from the server is treated as "already sent".
 */

const DB_NAME = 'dearly-outbox';
const STORE = 'letters';
const PHOTOS = 'letter-photos';
const VOICE = 'letter-voice';

/* ---------- IndexedDB ---------- */

let dbPromise;
const db = () =>
  (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

const putItem = (item) => tx('readwrite', (s) => s.put(item));
const removeItem = (id) => tx('readwrite', (s) => s.delete(id));
const getItem = (id) => tx('readonly', (s) => s.get(id));
const itemsFor = async (userId) =>
  ((await tx('readonly', (s) => s.getAll())) ?? [])
    .filter((i) => i.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);

/* ---------- Live status (what the banner shows) ---------- */

const listeners = new Set();
let snapshot = { pending: 0, failed: 0, flushing: false, lastError: '' };
let currentUserId = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dearly-outbox') : null;

const emit = (patch) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn(snapshot));
};

export const subscribeOutbox = (fn) => {
  listeners.add(fn);
  fn(snapshot);
  return () => listeners.delete(fn);
};

export const refreshOutbox = async (userId = currentUserId) => {
  if (!userId) return;
  currentUserId = userId;
  try {
    const items = await itemsFor(userId);
    const failed = items.filter((i) => i.status === 'failed');
    emit({ pending: items.length - failed.length, failed: failed.length, lastError: failed[0]?.error ?? '' });
  } catch (err) {
    console.error('Could not read the outbox:', err);
  }
};

// Another tab changed the queue
if (channel) channel.onmessage = () => refreshOutbox();
const announce = () => channel?.postMessage('changed');

/* ---------- Errors ---------- */

// "Try again later" errors: no connection, server hiccup, expired token. Anything else is final.
export const isNetworkError = (err) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.originalError?.message ?? ''}`.toLowerCase();
  return (
    err?.name === 'AuthRetryableFetchError' ||
    err instanceof TypeError ||
    err?.status === 0 ||
    err?.status === 429 ||
    err?.status >= 500 ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|jwt expired/.test(msg)
  );
};

/* ---------- Queueing ---------- */

/**
 * Save a letter to send later.
 * photos: already-compressed JPEG blobs · voice: { blob, mime } | null
 * schedule: { deliverAt, occasion, repeatYearly } | null
 */
export const enqueueLetter = async ({ user, recipients, greeting, content, signature, photos = [], voice = null, schedule = null }) => {
  const userId = user.id;
  const item = {
    id: crypto.randomUUID(),
    userId,
    senderEmail: user.email.toLowerCase(),
    createdAt: Date.now(),
    status: 'pending',
    error: '',
    content,
    signature,
    schedule,
    recipients: recipients.map((r) => ({
      messageId: crypto.randomUUID(),
      email: r.email,
      greeting: greeting.replace('[Name]', r.name),
      done: false,
    })),
    photos,
    photoPaths: photos.map(() => `${userId}/${crypto.randomUUID()}.jpg`),
    voice: voice ? { blob: voice.blob, mime: voice.mime } : null,
    voicePath: voice ? `${userId}/${crypto.randomUUID()}.${voiceExt(voice.mime)}` : null,
    uploaded: false,
  };
  await putItem(item);
  announce();
  await refreshOutbox(userId);
  return item;
};

/* ---------- Sending ---------- */

const upload = async (bucket, path, blob, contentType) => {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, cacheControl: '31536000' });
  // A retry after a dropped connection may find the file already there. That's fine.
  if (error && !/already exists|duplicate/i.test(error.message ?? '') && String(error.statusCode) !== '409') throw error;
};

// Returns 'sent' or 'failed'. Network errors are thrown so the letter stays queued.
const processItem = async (item) => {
  if (!item.uploaded) {
    for (let i = 0; i < item.photos.length; i++) {
      await upload(PHOTOS, item.photoPaths[i], item.photos[i], 'image/jpeg');
    }
    if (item.voice?.blob) await upload(VOICE, item.voicePath, item.voice.blob, item.voice.mime);
    item.uploaded = true;
    item.photos = []; // free the space, the paths are all we need now
    if (item.voice) item.voice = { mime: item.voice.mime };
    await putItem(item);
  }

  let finalError = null;
  for (const r of item.recipients) {
    if (r.done) continue;
    const base = {
      id: r.messageId,
      senderId: item.userId,
      senderEmail: item.senderEmail,
      recipientEmail: r.email,
      greeting: r.greeting,
      content: item.content,
      signature: item.signature,
      attachments: item.photoPaths,
      voicePath: item.voicePath,
    };
    try {
      if (item.schedule) await scheduleLetter({ ...base, ...item.schedule });
      else await sendMessage(base);
    } catch (err) {
      if (err?.code === '23505') {
        /* already delivered on an earlier attempt */
      } else if (isNetworkError(err)) {
        throw err;
      } else {
        finalError ??= err; // e.g. blocked by the recipient: keep going with the others
        continue;
      }
    }
    r.done = true;
    await putItem(item);
  }

  if (finalError) {
    item.status = 'failed';
    item.error = finalError.message || 'Something went wrong.';
    await putItem(item);
    return 'failed';
  }
  await removeItem(item.id);
  return 'sent';
};

let flushingNow = false;

/** Try to send everything waiting. Returns how many letters went out. */
export const flushOutbox = async (userId) => {
  if (flushingNow || !navigator.onLine) return 0;
  flushingNow = true;
  currentUserId = userId;
  let sent = 0;

  const run = async () => {
    emit({ flushing: true });
    try {
      await supabase.auth.getSession(); // refreshes an expired token before we try
      const items = (await itemsFor(userId)).filter((i) => i.status !== 'failed');
      for (const item of items) {
        try {
          if ((await processItem(item)) === 'sent') sent++;
        } catch (err) {
          if (isNetworkError(err)) break; // still no connection: keep the rest queued
          console.error('Queued letter failed:', err);
          item.status = 'failed';
          item.error = err?.message || 'Something went wrong.';
          await putItem(item);
        }
      }
    } catch (err) {
      console.error('Outbox flush failed:', err);
    } finally {
      emit({ flushing: false });
      announce();
      await refreshOutbox(userId);
    }
  };

  try {
    // One tab at a time, so two open windows can't send the same letter twice
    if (navigator.locks) await navigator.locks.request('dearly-outbox', { ifAvailable: true }, (lock) => (lock ? run() : null));
    else await run();
  } finally {
    flushingNow = false;
  }
  return sent;
};

/* ---------- Failed letters ---------- */

export const retryFailed = async (userId) => {
  for (const item of (await itemsFor(userId)).filter((i) => i.status === 'failed')) {
    item.status = 'pending';
    item.error = '';
    await putItem(item);
  }
  announce();
  await refreshOutbox(userId);
};

export const discardFailed = async (userId) => {
  for (const item of (await itemsFor(userId)).filter((i) => i.status === 'failed')) {
    const fresh = await getItem(item.id);
    // Only clean up uploads if no copy of the letter went out (otherwise they're in use)
    if (fresh?.uploaded && !fresh.recipients.some((r) => r.done)) {
      await removeAttachments(fresh.photoPaths);
      await removeVoice(fresh.voicePath);
    }
    await removeItem(item.id);
  }
  announce();
  await refreshOutbox(userId);
};
