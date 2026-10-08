-- =====================================================================
-- BME Portal – schema + RLS + storage. Run once in Supabase > SQL Editor.
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  subject_slug  text not null,
  track         text not null default 'main' check (track in ('theory','lab','main')),
  category      text not null check (category in ('lectures','quizzes','midterms','finals','summaries','videos')),
  title         text not null check (char_length(title) between 2 and 200),
  tags          text[] not null default '{}',
  badges        text[] not null default '{}',   -- high_yield | past_final | simplified
  file_path     text,                           -- path inside storage bucket "materials"
  file_kind     text not null default 'pdf' check (file_kind in ('pdf','image','doc','video','link')),
  external_url  text,
  uploader_name text check (uploader_name is null or char_length(uploader_name) <= 80),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  check (file_path is not null or external_url is not null)
);
create index if not exists items_lookup on public.items (status, subject_slug, track, category);

create table if not exists public.reports (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items(id) on delete cascade,
  reason     text check (reason is null or char_length(reason) <= 300),
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.items   enable row level security;
alter table public.reports enable row level security;

-- ITEMS: public sees approved only; anyone may INSERT but only as pending, no badges,
-- and only files under uploads/. Approve/reject happens server-side (service role).
drop policy if exists "items public read approved" on public.items;
create policy "items public read approved" on public.items
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "items public insert pending" on public.items;
create policy "items public insert pending" on public.items
  for insert to anon, authenticated
  with check (status = 'pending' and badges = '{}'::text[]
              and (file_path is null or file_path like 'uploads/%'));

drop policy if exists "items owner all" on public.items;
create policy "items owner all" on public.items
  for all to authenticated using (true) with check (true);

-- REPORTS: anyone can file a report; only the owner can read them.
drop policy if exists "reports public insert" on public.reports;
create policy "reports public insert" on public.reports
  for insert to anon, authenticated with check (resolved = false);

drop policy if exists "reports owner all" on public.reports;
create policy "reports owner all" on public.reports
  for all to authenticated using (true) with check (true);

-- STORAGE: public bucket, 30 MB limit, restricted mime types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', true, 31457280, array[
  'application/pdf','image/png','image/jpeg','image/webp',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "materials public read" on storage.objects;
create policy "materials public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'materials');

drop policy if exists "materials authenticated write" on storage.objects;
create policy "materials authenticated write" on storage.objects
  for insert to authenticated with check (bucket_id = 'materials');

drop policy if exists "materials authenticated update" on storage.objects;
create policy "materials authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'materials');

drop policy if exists "materials authenticated delete" on storage.objects;
create policy "materials authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'materials');
-- Student uploads need no INSERT policy: they use one-time signed upload URLs
-- created by /api/upload/sign (server-side, validated extension + size).
