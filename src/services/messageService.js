import { supabase } from '../supabaseClient';

export const PAGE_SIZE = 20;
const PHOTOS = 'letter-photos';
const VOICE = 'letter-voice';

export const fromRow = (r) => ({
  id: r.id,
  senderId: r.sender_id,
  senderEmail: r.sender_email,
  recipientEmail: r.recipient_email,
  greeting: r.greeting,
  content: r.content,
  signature: r.signature,
  attachments: r.attachments ?? [],
  voicePath: r.voice_path ?? null,
  isRead: r.is_read,
  date: r.created_at,
  deletedBySender: !!r.deleted_by_sender,
  deletedByRecipient: !!r.deleted_by_recipient,
});

// Keep user input from breaking PostgREST's filter syntax
const cleanTerm = (t) => t.replace(/[,()%*\\]/g, ' ').trim();

/**
 * One page of letters, newest first. Filtering happens in the database so
 * "Unread", "Sent", "Keepsakes" and search work across the whole inbox.
 * Pass `before` (the last letter's date) to get the next, older page.
 */
export const getMessages = async ({ filter = 'all', search = '', myEmail, before, limit = PAGE_SIZE } = {}) => {
  let q = supabase
    .from('messages')
    .select(filter === 'keepsakes' ? '*, keepsakes!inner(message_id)' : '*');

  // Each person only sees letters they haven't removed from their own mailbox
  if (filter === 'sent') q = q.eq('sender_email', myEmail).eq('deleted_by_sender', false);
  else if (filter === 'all' || filter === 'unread') q = q.neq('sender_email', myEmail).eq('deleted_by_recipient', false);
  else {
    q = q.or(
      `and(sender_email.eq.${myEmail},deleted_by_sender.eq.false),and(recipient_email.eq.${myEmail},deleted_by_recipient.eq.false)`
    );
  }
  if (filter === 'unread') q = q.eq('is_read', false);

  const term = cleanTerm(search);
  if (term) {
    q = q.or(`sender_email.ilike.%${term}%,recipient_email.ilike.%${term}%,greeting.ilike.%${term}%`);
  }
  if (before) q = q.lt('created_at', before);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(fromRow);
};

export const getMessage = async (id) => {
  const { data, error } = await supabase.from('messages').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
};

const PROFILES_CACHE = 'dearly_profiles_cache';

export const getProfiles = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, avatar_path, bio')
      .eq('hidden', false); // admin accounts are kept out of the people list
    if (error) throw error;
    try {
      localStorage.setItem(PROFILES_CACHE, JSON.stringify(data ?? []));
    } catch {
      /* cache is best-effort */
    }
    return data ?? [];
  } catch (err) {
    // Offline: fall back to the last list we saw so the "To:" picker still works
    try {
      const cached = JSON.parse(localStorage.getItem(PROFILES_CACHE) || 'null');
      if (Array.isArray(cached)) return cached;
    } catch {
      /* ignore */
    }
    throw err;
  }
};

export const sendMessage = async (m) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      ...(m.id ? { id: m.id } : {}), // queued letters carry their own id so a retry can't double-send
      sender_id: m.senderId,
      sender_email: m.senderEmail,
      recipient_email: m.recipientEmail.toLowerCase(),
      greeting: m.greeting,
      content: m.content,
      signature: m.signature,
      attachments: m.attachments ?? [],
      voice_path: m.voicePath ?? null,
    }])
    .select();
  if (error) throw error;
  return fromRow(data[0]);
};

export const markAsRead = async (id) => {
  const { error } = await supabase.from('messages').update({ is_read: true }).eq('id', id);
  if (error) throw error;
};

// Removes the letter from MY mailbox only. The other person keeps their copy.
// (The database deletes the row for good once both people have removed it.)
export const deleteMessage = async (id) => {
  const { error } = await supabase.rpc('delete_message_for_me', { p_id: id });
  if (error) throw error;
};

// Removes the letter for BOTH people. Only the sender may do this (the database enforces it).
// Attached photos and the voice note are cleaned up afterwards (best effort).
export const deleteMessageForEveryone = async (msg) => {
  const { error } = await supabase.rpc('delete_message_for_everyone', { p_id: msg.id });
  if (error) throw error;
  await removeAttachments(msg.attachments);
  await removeVoice(msg.voicePath);
};

/* ---------- Deleted letters (my removed copies, which I can bring back) ---------- */

export const getDeletedMessages = async (myEmail, limit = 100) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_email.eq.${myEmail},deleted_by_sender.eq.true),and(recipient_email.eq.${myEmail},deleted_by_recipient.eq.true)`
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(fromRow);
};

export const restoreMessage = async (id) => {
  const { error } = await supabase.rpc('restore_message_for_me', { p_id: id });
  if (error) throw error;
};

/* ---------- Keepsakes (private to each person) ---------- */

export const getKeepsakeIds = async () => {
  const { data, error } = await supabase.from('keepsakes').select('message_id');
  if (error) throw error;
  return (data ?? []).map((r) => r.message_id);
};

export const addKeepsake = async (messageId) => {
  const { error } = await supabase.from('keepsakes').insert([{ message_id: messageId }]);
  if (error && error.code !== '23505') throw error; // 23505 = already starred
};

export const removeKeepsake = async (messageId) => {
  const { error } = await supabase.from('keepsakes').delete().eq('message_id', messageId);
  if (error) throw error;
};

/* ---------- Photo attachments ---------- */

export const removeAttachments = async (paths) => {
  if (!paths?.length) return;
  try {
    await supabase.storage.from(PHOTOS).remove(paths);
  } catch {
    /* best effort */
  }
};

export const uploadAttachments = async (userId, blobs) => {
  const paths = [];
  try {
    for (const blob of blobs) {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from(PHOTOS)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  } catch (err) {
    await removeAttachments(paths);
    throw err;
  }
};

// The bucket is private: photos are shown through short-lived signed links
export const getAttachmentUrls = async (paths) => {
  if (!paths?.length) return [];
  const { data, error } = await supabase.storage.from(PHOTOS).createSignedUrls(paths, 3600);
  if (error) throw error;
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean);
};

/* ---------- Voice messages ---------- */

export const voiceExt = (mime = '') => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

export const uploadVoice = async (userId, blob, mime) => {
  const path = `${userId}/${crypto.randomUUID()}.${voiceExt(mime)}`;
  const { error } = await supabase.storage
    .from(VOICE)
    .upload(path, blob, { contentType: mime, cacheControl: '31536000' });
  if (error) throw error;
  return path;
};

export const removeVoice = async (path) => {
  if (!path) return;
  try {
    await supabase.storage.from(VOICE).remove([path]);
  } catch {
    /* best effort */
  }
};

// The bucket is private: the recording is played through a short-lived signed link
export const getVoiceUrl = async (path) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(VOICE).createSignedUrl(path, 3600);
  if (error) throw error;
  return data?.signedUrl ?? null;
};

/* ---------- Scheduled letters (delivered by pg_cron) ---------- */

export const scheduleLetter = async (m) => {
  const { error } = await supabase.from('scheduled_letters').insert([{
    ...(m.id ? { id: m.id } : {}),
    sender_id: m.senderId,
    sender_email: m.senderEmail,
    recipient_email: m.recipientEmail.toLowerCase(),
    greeting: m.greeting,
    content: m.content,
    signature: m.signature,
    attachments: m.attachments ?? [],
    voice_path: m.voicePath ?? null,
    occasion: m.occasion || null,
    deliver_at: m.deliverAt,
    repeat_yearly: !!m.repeatYearly,
  }]);
  if (error) throw error;
};

export const getScheduledLetters = async () => {
  const { data, error } = await supabase
    .from('scheduled_letters')
    .select('*')
    .is('delivered_at', null)
    .order('deliver_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const cancelScheduled = async (id) => {
  const { data, error } = await supabase.from('scheduled_letters').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('This letter was already delivered or removed.');
};

/**
 * Live inbox: listens for changes to the messages table.
 * Requires Realtime to be enabled for the table in Supabase.
 * RLS still decides which INSERT/UPDATE rows you receive.
 * Returns an unsubscribe function.
 */
export const subscribeToMessages = (userId, { onInsert, onUpdate, onDelete, onStatus }) => {
  const channel = supabase
    .channel(`messages-live-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) =>
      onInsert?.(fromRow(p.new))
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) =>
      onUpdate?.(fromRow(p.new))
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) =>
      onDelete?.(p.old?.id)
    )
    .subscribe((status) => onStatus?.(status));

  return () => {
    supabase.removeChannel(channel);
  };
};

export const getUnreadCount = async (myEmail) => {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_email', myEmail)
    .eq('deleted_by_recipient', false)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
};