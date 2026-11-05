-- Dearly: voice messages migration
-- Run once in the Supabase SQL editor, BEFORE deploying the new code.
-- Safe to re-run: everything is idempotent.

-- 1. Columns ---------------------------------------------------
alter table public.messages          add column if not exists voice_path text;
alter table public.scheduled_letters add column if not exists voice_path text;

-- 2. Private bucket for recordings -----------------------------
-- Browsers record webm (Chrome/Android/Edge), ogg (Firefox) or mp4/m4a (Safari/iOS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'letter-voice', 'letter-voice', false, 10485760,
  array['audio/webm','audio/ogg','audio/mp4','audio/x-m4a','audio/aac','audio/mpeg','audio/wav']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "letter voice: upload to own folder" on storage.objects;
create policy "letter voice: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'letter-voice' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only the sender and the person it was sent to can listen
drop policy if exists "letter voice: read own or received" on storage.objects;
create policy "letter voice: read own or received" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'letter-voice'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.messages m
        where objects.name = m.voice_path
          and lower(m.recipient_email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

drop policy if exists "letter voice: delete own" on storage.objects;
create policy "letter voice: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'letter-voice' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Scheduled letters must carry the recording into messages ---
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
    insert into public.messages (sender_id, sender_email, recipient_email, greeting, content, signature, attachments, voice_path)
    values (r.sender_id, lower(r.sender_email), lower(r.recipient_email), r.greeting, r.content, r.signature, r.attachments, r.voice_path);

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

revoke all on function public.deliver_scheduled_letters() from public, anon, authenticated;
