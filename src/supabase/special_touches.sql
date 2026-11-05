-- Dearly: "special touches" migration
-- Run once in the Supabase SQL editor, BEFORE deploying the new code.
-- Safe to re-run: everything is idempotent.

-- ============================================================
-- 1. Profiles: avatar + default signature
-- ============================================================
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists default_signature text;

-- People may edit only their own row, and only these columns (email stays untouchable)
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (name, avatar_path, default_signature) on public.profiles to authenticated;

-- ============================================================
-- 2. Photo attachments: column on messages
-- ============================================================
alter table public.messages add column if not exists attachments text[] not null default '{}';

-- ============================================================
-- 3. Keepsakes: each person's private stars
-- ============================================================
do $$
declare id_type text;
begin
  -- match whatever type messages.id is (uuid or bigint)
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.messages'::regclass and a.attname = 'id' and not a.attisdropped;

  execute format($f$
    create table if not exists public.keepsakes (
      user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
      message_id %s not null references public.messages(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, message_id)
    )$f$, id_type);
end $$;

alter table public.keepsakes enable row level security;

drop policy if exists "keepsakes: read own" on public.keepsakes;
create policy "keepsakes: read own" on public.keepsakes
  for select to authenticated using (user_id = auth.uid());

-- you can only star a letter you're allowed to see (the subquery runs under your messages RLS)
drop policy if exists "keepsakes: add own" on public.keepsakes;
create policy "keepsakes: add own" on public.keepsakes
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id));

drop policy if exists "keepsakes: remove own" on public.keepsakes;
create policy "keepsakes: remove own" on public.keepsakes
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 4. Storage buckets
-- ============================================================
-- Letter photos: PRIVATE. Only the sender and the recipient can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letter-photos', 'letter-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "letter photos: upload to own folder" on storage.objects;
create policy "letter photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'letter-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "letter photos: read own or received" on storage.objects;
create policy "letter photos: read own or received" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'letter-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.messages m
        where objects.name = any (m.attachments)
          and lower(m.recipient_email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

drop policy if exists "letter photos: delete own" on storage.objects;
create policy "letter photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'letter-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Avatars: PUBLIC read (so they load fast and are cacheable); only you can write your own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: upload to own folder" on storage.objects;
create policy "avatars: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 5. Scheduled letters (delivered by pg_cron)
-- ============================================================
create table if not exists public.scheduled_letters (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_email text not null,
  recipient_email text not null,
  greeting text,
  content text not null,
  signature text,
  attachments text[] not null default '{}',
  occasion text,
  deliver_at timestamptz not null,
  repeat_yearly boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_letters_due_idx
  on public.scheduled_letters (deliver_at) where delivered_at is null;

alter table public.scheduled_letters enable row level security;

drop policy if exists "scheduled: read own" on public.scheduled_letters;
create policy "scheduled: read own" on public.scheduled_letters
  for select to authenticated using (sender_id = auth.uid());

-- sender_email must be your real email, so nobody can schedule a letter "from" someone else
drop policy if exists "scheduled: add own" on public.scheduled_letters;
create policy "scheduled: add own" on public.scheduled_letters
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and lower(sender_email) = lower(auth.jwt() ->> 'email')
    and deliver_at > now()
  );

drop policy if exists "scheduled: cancel own" on public.scheduled_letters;
create policy "scheduled: cancel own" on public.scheduled_letters
  for delete to authenticated using (sender_id = auth.uid());

-- Moves every due letter into messages. Yearly letters are pushed forward a year instead of finishing.
create or replace function public.deliver_scheduled_letters()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  nxt timestamptz;
  n integer := 0;
begin
  for r in
    select * from public.scheduled_letters
    where delivered_at is null and deliver_at <= now()
    order by deliver_at
    for update skip locked
  loop
    insert into public.messages (sender_id, sender_email, recipient_email, greeting, content, signature, attachments)
    values (r.sender_id, lower(r.sender_email), lower(r.recipient_email), r.greeting, r.content, r.signature, r.attachments);

    if r.repeat_yearly then
      nxt := r.deliver_at + interval '1 year';
      while nxt <= now() loop
        nxt := nxt + interval '1 year';
      end loop;
      update public.scheduled_letters set deliver_at = nxt where id = r.id;
    else
      update public.scheduled_letters set delivered_at = now() where id = r.id;
    end if;

    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Only the cron job (and you, in the SQL editor) may run it, never the browser
revoke all on function public.deliver_scheduled_letters() from public, anon, authenticated;

-- Check every 5 minutes. pg_cron must be enabled (Database -> Extensions -> pg_cron) if the next line errors.
create extension if not exists pg_cron;

select cron.unschedule(jobname) from cron.job where jobname = 'deliver-scheduled-letters';
select cron.schedule(
  'deliver-scheduled-letters',
  '*/5 * * * *',
  $cron$select public.deliver_scheduled_letters();$cron$
);
