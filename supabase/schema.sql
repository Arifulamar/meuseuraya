-- Meuseuraya Inklusi: initial backend schema
-- Run in Supabase SQL Editor only after reviewing this file.
-- Do not use real student data until policies and operational safeguards are reviewed.

create extension if not exists pgcrypto;

create type public.app_role as enum ('guru', 'orangtua', 'psikolog', 'admin');
create type public.note_kind as enum ('observasi', 'aktivitas_rumah', 'rekomendasi', 'tindak_lanjut', 'lainnya');
create type public.notification_kind as enum ('catatan_baru', 'rekomendasi', 'permintaan_tindak_lanjut', 'sistem');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  role public.app_role not null default 'guru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  display_label text not null check (char_length(display_label) between 1 and 120),
  class_label text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- A child is visible only to explicitly assigned users.
create table public.child_memberships (
  child_id uuid not null references public.children(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role public.app_role not null check (access_role in ('guru','orangtua','psikolog')),
  can_read boolean not null default true,
  can_write boolean not null default true,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  kind public.note_kind not null default 'lainnya',
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  next_step text check (next_step is null or char_length(next_step) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind public.notification_kind not null default 'sistem',
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 1000),
  related_note_id uuid references public.notes(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index child_memberships_user_idx on public.child_memberships(user_id, child_id);
create index notes_child_created_idx on public.notes(child_id, created_at desc) where deleted_at is null;
create index notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);

create or replace function public.is_child_member(target_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.child_memberships cm
    where cm.child_id = target_child
      and cm.user_id = (select auth.uid())
      and cm.can_read = true
  );
$$;

create or replace function public.can_write_child(target_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.child_memberships cm
    where cm.child_id = target_child
      and cm.user_id = (select auth.uid())
      and cm.can_write = true
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.child_memberships enable row level security;
alter table public.notes enable row level security;
alter table public.notifications enable row level security;

-- Users may read their own profile. Admin profile management must be done through trusted server/admin tooling.
create policy "profiles_select_self" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_self_name" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role = (select public.current_app_role()));
-- No client insert/delete policy for profiles; create profiles via trusted trigger or server workflow.

create policy "children_select_assigned" on public.children
for select to authenticated using (public.is_child_member(id));
create policy "children_insert_guru" on public.children
for insert to authenticated with check (
  created_by = (select auth.uid()) and (select public.current_app_role()) = 'guru'
);
create policy "children_update_guru_member" on public.children
for update to authenticated using (
  public.can_write_child(id) and (select public.current_app_role()) = 'guru'
) with check (
  public.can_write_child(id) and (select public.current_app_role()) = 'guru'
);

create policy "memberships_select_same_child" on public.child_memberships
for select to authenticated using (public.is_child_member(child_id));
-- Membership assignment intentionally has no client insert/update/delete policy.
-- Assignments must be made by a trusted admin/server process after consent/verification.

create policy "notes_select_assigned" on public.notes
for select to authenticated using (
  deleted_at is null and public.is_child_member(child_id)
);
create policy "notes_insert_authorized" on public.notes
for insert to authenticated with check (
  author_id = (select auth.uid())
  and public.can_write_child(child_id)
  and (select public.current_app_role()) = (
    select cm.access_role from public.child_memberships cm
    where cm.child_id = notes.child_id and cm.user_id = (select auth.uid())
  )
);
create policy "notes_update_authorized_own" on public.notes
for update to authenticated using (
  author_id = (select auth.uid()) and public.can_write_child(child_id)
) with check (
  author_id = (select auth.uid()) and public.can_write_child(child_id)
);
-- No client hard-delete policy; use soft delete or trusted retention tooling.

create policy "notifications_select_recipient" on public.notifications
for select to authenticated using (recipient_id = (select auth.uid()));
create policy "notifications_update_read_own" on public.notifications
for update to authenticated using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));
-- No client insert policy: create notifications through trusted server/Edge Function only.

-- Enable Realtime only for tables that clients are allowed to subscribe to.
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.notifications;
