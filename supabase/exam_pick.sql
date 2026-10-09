alter table public.items add column if not exists exam_pick boolean not null default false;

drop policy if exists "items public insert pending" on public.items;
create policy "items public insert pending" on public.items
  for insert to anon, authenticated
  with check (status = 'pending' and badges = '{}'::text[] and exam_pick = false
              and (file_path is null or file_path like 'uploads/%'));
