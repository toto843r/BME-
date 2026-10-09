-- Run once in Supabase SQL Editor. Additive migration; does not modify existing items.
create table if not exists public.quiz_banks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  file_path text not null,
  content_hash text,
  status text not null default 'pending' check (status in ('pending','generating','ready','failed')),
  questions jsonb,
  error_message text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (item_id, file_path)
);
create index if not exists quiz_banks_item_idx on public.quiz_banks (item_id);
alter table public.quiz_banks enable row level security;
-- No direct public writes; server uses service role and verifies item approval.
revoke all on table public.quiz_banks from anon, authenticated;
-- Single atomic lock across every Vercel instance. Failed jobs can retry after 24h;
-- interrupted jobs after 10min. Caller must be verified service-role backend.
create or replace function public.claim_quiz_generation(p_item_id uuid, p_file_path text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.quiz_banks (item_id, file_path, status, updated_at)
  values (p_item_id, p_file_path, 'generating', now())
  on conflict (item_id, file_path) do update
    set status = 'generating', updated_at = now(), error_message = null
    where (quiz_banks.status = 'generating' and quiz_banks.updated_at < now() - interval '10 minutes')
       or (quiz_banks.status = 'failed' and quiz_banks.updated_at < now() - interval '24 hours')
       or quiz_banks.status = 'pending'
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.claim_quiz_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_quiz_generation(uuid, text) to service_role;
