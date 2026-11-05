import { supabase } from '../supabaseClient';

const AVATARS = 'avatars';
const COLUMNS = 'id, email, name, avatar_path, default_signature, bio';

export const avatarUrl = (path) =>
  path ? supabase.storage.from(AVATARS).getPublicUrl(path).data.publicUrl : null;

export const getMyProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
};

export const updateMyProfile = async (userId, patch) => {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select(COLUMNS);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Could not save your profile. Check the profiles update policy.');
  }
  return data[0];
};

// A new file name each time, so browsers and CDNs never show a stale avatar
export const uploadAvatar = async (userId, blob) => {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATARS)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return path;
};

export const removeAvatarFile = async (path) => {
  if (!path) return;
  try {
    await supabase.storage.from(AVATARS).remove([path]);
  } catch {
    /* best effort */
  }
};
