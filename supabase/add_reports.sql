-- allow the new "reports" category (drops the old category check, whatever its name)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.items'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%lectures%'
  loop
    execute format('alter table public.items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.items add constraint items_category_check
  check (category in ('lectures','reports','quizzes','midterms','finals','summaries','videos'));
