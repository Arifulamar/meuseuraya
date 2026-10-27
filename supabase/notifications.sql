-- Meuseuraya Inklusi: automatic in-app notifications for notes
-- Run this AFTER supabase/schema.sql in Supabase SQL Editor.
-- Test only with dummy users and dummy child records first.
-- Notifications contain generic text only; sensitive note contents are not copied.

create or replace function public.notify_members_after_note_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_role public.app_role;
  notification_title text;
  notification_message text;
  notification_type public.notification_kind;
begin
  select cm.access_role
    into author_role
  from public.child_memberships cm
  where cm.child_id = new.child_id
    and cm.user_id = new.author_id
    and cm.can_read = true;

  -- Only notify when the author has a valid assignment to this child.
  if author_role is null then
    return new;
  end if;

  if author_role = 'orangtua' then
    notification_title := 'Catatan baru dari Orang Tua';
    notification_message := 'Ada catatan baru untuk anak yang menjadi tanggung jawab Anda.';
    notification_type := 'catatan_baru';
  elsif author_role = 'psikolog' then
    notification_title := 'Umpan balik Psikolog tersedia';
    notification_message := 'Psikolog menambahkan catatan atau umpan balik untuk anak yang menjadi tanggung jawab Anda.';
    notification_type := 'rekomendasi';
  elsif author_role = 'guru' then
    notification_title := 'Catatan baru dari Guru';
    notification_message := 'Guru menambahkan catatan untuk anak yang menjadi tanggung jawab Anda.';
    notification_type := 'catatan_baru';
  else
    return new;
  end if;

  insert into public.notifications
    (recipient_id, child_id, actor_id, kind, title, message, related_note_id)
  select cm.user_id, new.child_id, new.author_id, notification_type,
         notification_title, notification_message, new.id
  from public.child_memberships cm
  where cm.child_id = new.child_id
    and cm.user_id <> new.author_id
    and cm.can_read = true
    and (
      (author_role = 'orangtua' and cm.access_role in ('guru', 'psikolog'))
      or (author_role = 'psikolog' and cm.access_role in ('guru', 'orangtua'))
      or (author_role = 'guru' and cm.access_role in ('orangtua', 'psikolog'))
    );

  return new;
end;
$$;

drop trigger if exists notes_notify_members_after_insert on public.notes;
create trigger notes_notify_members_after_insert
after insert on public.notes
for each row
when (new.deleted_at is null)
execute function public.notify_members_after_note_insert();

-- Make sure notifications are included in Supabase Realtime.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime not found; enable it in Supabase Dashboard.';
end $$;
