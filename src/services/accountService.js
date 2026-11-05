import { supabase } from '../supabaseClient';

const BUCKETS = ['letter-photos', 'avatars'];

// Remove every file in the user's own folder of a bucket (best effort)
const emptyOwnFolder = async (bucket, userId) => {
  try {
    const store = supabase.storage.from(bucket);
    const { data } = await store.list(userId, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length) await store.remove(paths);
  } catch {
    /* best effort */
  }
};

/**
 * Permanently deletes the signed-in person's account and data.
 * Files are removed first (while we can still sign in to Storage),
 * then the database function removes letters, profile and the login itself.
 */
export const deleteMyAccount = async (userId) => {
  await Promise.all(BUCKETS.map((b) => emptyOwnFolder(b, userId)));
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
};
