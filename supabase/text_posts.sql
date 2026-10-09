-- allow text-only posts (quizzes / midterms / finals) + longer descriptions (5000 chars)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.items'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%external_url%'
        or pg_get_constraintdef(oid) like '%file_kind%'
        or pg_get_constraintdef(oid) like '%char_length(description)%')
  loop
    execute format('alter table public.items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.items add constraint items_file_kind_check
  check (file_kind in ('pdf','image','doc','video','link','text'));
alter table public.items add constraint items_description_len_check
  check (description is null or char_length(description) <= 5000);
alter table public.items add constraint items_has_content_check
  check (file_path is not null or external_url is not null
         or (description is not null and category in ('quizzes','midterms','finals')));
