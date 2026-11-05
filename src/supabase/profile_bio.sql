-- Dearly: profile bio migration
-- Run once in the Supabase SQL editor, BEFORE deploying the new code.
-- Safe to re-run.

alter table public.profiles add column if not exists bio text;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 200);

-- People may edit only these columns of their own row (adds "bio" to the earlier list)
grant update (name, avatar_path, default_signature, bio) on public.profiles to authenticated;
