-- Lets a person bring back a letter they deleted from their own mailbox.
-- Run in the Supabase SQL Editor (after per_person_delete.sql).
create or replace function public.restore_message_for_me(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.messages;
  uid uuid := auth.uid();
  mail text := lower(auth.jwt() ->> 'email');
begin
  if uid is null then
    raise exception 'You must be signed in.';
  end if;

  select * into m from public.messages where id = p_id;
  if not found or not (m.sender_id = uid or lower(m.recipient_email) = mail) then
    raise exception 'Letter not found.';
  end if;

  update public.messages
     set deleted_by_sender = case when m.sender_id = uid then false else deleted_by_sender end,
         deleted_by_recipient = case when lower(m.recipient_email) = mail then false else deleted_by_recipient end
   where id = p_id;
end;
$$;

revoke all on function public.restore_message_for_me(uuid) from public, anon;
grant execute on function public.restore_message_for_me(uuid) to authenticated;
