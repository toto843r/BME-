-- BME Portal: temporary announcements (run ONCE in existing Supabase SQL Editor).
-- Does not drop or alter the existing items, quiz_banks, reports or storage.
create table if not exists public.portal_notices (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 400),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  deleted_at timestamptz,
  constraint portal_notice_expiry_valid check (expires_at > created_at)
);

create index if not exists portal_notices_active_idx
  on public.portal_notices (created_at desc)
  where deleted_at is null;

alter table public.portal_notices enable row level security;
-- Students can only read not-yet-expired, not-deleted messages.
-- Admin changes go via the server, authenticated with ADMIN_PIN + service_role.
drop policy if exists "Read active portal notices" on public.portal_notices;
create policy "Read active portal notices" on public.portal_notices
  for select to anon, authenticated
  using (deleted_at is null and expires_at > now());

revoke insert, update, delete on public.portal_notices from anon, authenticated;
grant select on public.portal_notices to anon, authenticated;
