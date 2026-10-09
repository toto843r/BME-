-- several files per post: the first one stays in file_path, the rest go here
alter table public.items add column if not exists attachments jsonb not null default '[]'::jsonb;
