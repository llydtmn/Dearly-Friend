import { supabase } from '../supabaseClient';

export const PAGE_SIZE = 20;
const PHOTOS = 'letter-photos';

export const fromRow = (r) => ({
  id: r.id,
  senderId: r.sender_id,
  senderEmail: r.sender_email,
  recipientEmail: r.recipient_email,
  greeting: r.greeting,
  content: r.content,
  signature: r.signature,
  attachments: r.attachments ?? [],
  isRead: r.is_read,
  date: r.created_at,
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

  if (filter === 'sent') q = q.eq('sender_email', myEmail);
  else if (filter === 'all' || filter === 'unread') q = q.neq('sender_email', myEmail);
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

export const getProfiles = async () => {
  const { data, error } = await supabase.from('profiles').select('id, email, name, avatar_path');
  if (error) throw error;
  return data ?? [];
};

export const sendMessage = async (m) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      sender_id: m.senderId,
      sender_email: m.senderEmail,
      recipient_email: m.recipientEmail.toLowerCase(),
      greeting: m.greeting,
      content: m.content,
      signature: m.signature,
      attachments: m.attachments ?? [],
    }])
    .select();
  if (error) throw error;
  return fromRow(data[0]);
};

export const markAsRead = async (id) => {
  const { error } = await supabase.from('messages').update({ is_read: true }).eq('id', id);
  if (error) throw error;
};

export const deleteMessage = async (id) => {
  const { data, error } = await supabase.from('messages').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Delete was blocked. Check the Supabase delete policy.');
  }
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

/* ---------- Scheduled letters (delivered by pg_cron) ---------- */

export const scheduleLetter = async (m) => {
  const { error } = await supabase.from('scheduled_letters').insert([{
    sender_id: m.senderId,
    sender_email: m.senderEmail,
    recipient_email: m.recipientEmail.toLowerCase(),
    greeting: m.greeting,
    content: m.content,
    signature: m.signature,
    attachments: m.attachments ?? [],
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
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
};