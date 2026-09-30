-- Legacy report views must respect the requesting user's existing report policies.
-- The view is optional in fresh installs; this migration leaves report data untouched.
do $$
begin
  if to_regclass('public.v_reports_with_meta') is not null then
    alter view public.v_reports_with_meta set (security_invoker = true);
  end if;
  -- The deployed schema has insert/select/delete policies but no owner update policy.
  -- Editing and autosaving an existing draft must only be allowed to its author.
  if to_regclass('public.reports') is not null and not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reports'
      and policyname = 'authors update own reports'
  ) then
    create policy "authors update own reports" on public.reports
      for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
  end if;
end;
$$;
