-- The existing editor and Report type treat edition as optional.
-- Accept their null payload; keep existing edition values and the default unchanged.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reports' and column_name = 'edition'
  ) then
    alter table public.reports alter column edition drop not null;
  end if;
end;
$$;
