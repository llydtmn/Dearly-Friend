// Add this to src/services/messageService.js (anywhere after the imports)
export const getUnreadCount = async (myEmail) => {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_email', myEmail)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
};