import { supabase } from '../supabaseClient';

export const fromRow = (r) => ({
  id: r.id,
  senderId: r.sender_id,
  senderEmail: r.sender_email,
  recipientEmail: r.recipient_email,
  greeting: r.greeting,
  content: r.content,
  signature: r.signature,
  isRead: r.is_read,
  date: r.created_at,
});

export const getMessages = async () => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
};

export const getProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name');
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
    }])
    .select();
  if (error) throw error;
  return fromRow(data[0]);
};

export const markAsRead = async (id) => {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
};

export const deleteMessage = async (id) => {
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Delete was blocked. Check the Supabase delete policy.');
  }
};

/**
 * Live inbox: listens for changes to the messages table.
 * Requires Realtime to be enabled for the table in Supabase
 * (see SETUP.md). RLS still decides which INSERT/UPDATE rows you receive.
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
