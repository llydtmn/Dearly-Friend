-- Dearly: "safety and gaps" migration
-- Run once in the Supabase SQL editor. Safe to re-run: everything is idempotent.

-- ============================================================
-- 1. Rate limits: letters per user per hour / per day
--    Change the numbers below to tune them.
-- ============================================================
create or replace function public.enforce_letter_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_per_hour constant int := 20;
  max_per_day  constant int := 60;
  uid uuid := auth.uid();
  n_hour int;
  n_day int;
begin
  -- Cron delivery of scheduled letters and the SQL editor have no signed-in user: don't limit those.
  -- (Scheduled letters are limited when they are scheduled.)
  if uid is null then
    return new;
  end if;

  execute format(
    'select count(*) filter (where created_at > now() - interval ''1 hour''),
            count(*) filter (where created_at > now() - interval ''1 day'')
       from %I.%I
      where sender_id = $1 and created_at > now() - interval ''1 day''',
    tg_table_schema, tg_table_name)
  into n_hour, n_day
  using uid;

  if n_hour >= max_per_hour then
    raise exception 'You have sent a lot of letters in the last hour (limit: %). Please try again a little later.', max_per_hour
      using errcode = 'P0001';
  end if;
  if n_day >= max_per_day then
    raise exception 'You have reached today''s limit of % letters. Please try again tomorrow.', max_per_day
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_letter_rate_limit() from public, anon, authenticated;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_letter_rate_limit();

drop trigger if exists scheduled_letters_rate_limit on public.scheduled_letters;
create trigger scheduled_letters_rate_limit
  before insert on public.scheduled_letters
  for each row execute function public.enforce_letter_rate_limit();

-- ============================================================
-- 2. "Stop emails from this sender"
--    Each recipient can silence notification emails from one sender.
--    The code that SENDS the notification email must skip a letter when
--    public.email_blocked(recipient, sender) is true.
-- ============================================================
create table if not exists public.email_blocks (
  recipient_email text not null,
  sender_email text not null,
  created_at timestamptz not null default now(),
  primary key (recipient_email, sender_email),
  check (recipient_email = lower(recipient_email) and sender_email = lower(sender_email))
);

alter table public.email_blocks enable row level security;

drop policy if exists "email_blocks: read own" on public.email_blocks;
create policy "email_blocks: read own" on public.email_blocks
  for select to authenticated
  using (recipient_email = lower(auth.jwt() ->> 'email'));

drop policy if exists "email_blocks: add own" on public.email_blocks;
create policy "email_blocks: add own" on public.email_blocks
  for insert to authenticated
  with check (recipient_email = lower(auth.jwt() ->> 'email'));

drop policy if exists "email_blocks: remove own" on public.email_blocks;
create policy "email_blocks: remove own" on public.email_blocks
  for delete to authenticated
  using (recipient_email = lower(auth.jwt() ->> 'email'));

-- For the email sender (webhook / edge function / trigger) to call
create or replace function public.email_blocked(p_recipient text, p_sender text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.email_blocks
    where recipient_email = lower(p_recipient) and sender_email = lower(p_sender)
  );
$$;

revoke all on function public.email_blocked(text, text) from public, anon, authenticated;

-- ============================================================
-- 3. Delete my account
--    Removes letters sent or received, scheduled letters, keepsakes, profile, and the login itself.
--    (Files in Storage are removed by the app just before this runs.)
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  mail text := lower(auth.jwt() ->> 'email');
begin
  if uid is null then
    raise exception 'You must be signed in.';
  end if;

  delete from public.keepsakes where user_id = uid;
  delete from public.scheduled_letters where sender_id = uid;
  delete from public.email_blocks where recipient_email = mail;
  delete from public.messages where sender_id = uid or lower(recipient_email) = mail;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
