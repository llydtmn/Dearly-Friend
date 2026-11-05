import { supabase } from '../supabaseClient';

// People can silence email notifications from a specific sender.
// Letters still arrive in the app; only the email is skipped.

export const getBlockedSenders = async () => {
  const { data, error } = await supabase
    .from('email_blocks')
    .select('sender_email')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => r.sender_email);
};

export const blockSender = async (myEmail, senderEmail) => {
  const { error } = await supabase.from('email_blocks').insert([{
    recipient_email: myEmail.trim().toLowerCase(),
    sender_email: senderEmail.trim().toLowerCase(),
  }]);
  if (error && error.code !== '23505') throw error; // 23505 = already blocked
};

export const unblockSender = async (myEmail, senderEmail) => {
  const { error } = await supabase
    .from('email_blocks')
    .delete()
    .eq('recipient_email', myEmail.trim().toLowerCase())
    .eq('sender_email', senderEmail.trim().toLowerCase());
  if (error) throw error;
};
