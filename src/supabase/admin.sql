-- ============================================================
-- Dearly admin: list users + delete a user (and everything they own)
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- 1. Who is allowed to use the admin page.
--    RLS is on with no policies, so the app can't read or change this table. Only you, here in SQL.
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;

insert into public.admins (email) values ('PUT-YOUR-EMAIL-HERE@gmail.com')  -- <-- change this
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. List every user with how many letters they sent and received
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  letters_sent bigint,
  letters_received bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.name,
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.messages m where m.sender_id = u.id),
    (select count(*) from public.messages m where lower(m.recipient_email) = lower(u.email))
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- 3. Delete one user and all their data (same cleanup as "Delete my account")
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  mail text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed.';
  end if;
  if target = auth.uid() then
    raise exception 'You can''t delete your own account from the admin page.';
  end if;

  select lower(email) into mail from auth.users where id = target;
  if mail is null then
    raise exception 'User not found.';
  end if;

  -- other people's keepsakes of this person's letters
  delete from public.keepsakes
    where message_id in (
      select id from public.messages where sender_id = target or lower(recipient_email) = mail
    );
  delete from public.keepsakes where user_id = target;
  delete from public.scheduled_letters where sender_id = target;
  delete from public.push_subscriptions where user_id = target;
  delete from public.email_blocks where recipient_email = mail or sender_email = mail;
  delete from public.messages where sender_id = target or lower(recipient_email) = mail;
  delete from public.profiles where id = target;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
