-- Run once in the existing Supabase project's SQL editor. Existing tables are unchanged.
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null default 0,
  state jsonb not null,
  processing_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_sessions_user_updated on public.ai_sessions (user_id, updated_at desc);
alter table public.ai_sessions enable row level security;
create policy "AI sessions belong to their author" on public.ai_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.ai_sessions to authenticated;

-- Persistent, atomic quota. There is no browser write policy on this table.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  requests integer not null default 0,
  primary key (user_id, bucket)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
create or replace function public.claim_ai_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, bucket, requests)
  values (auth.uid(), date_trunc('hour', now()), 1)
  on conflict (user_id, bucket) do update
    set requests = public.ai_usage.requests + 1 where public.ai_usage.requests < 40
  returning requests into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_ai_request() from public;
grant execute on function public.claim_ai_request() to authenticated;

create or replace function public.lock_ai_session(session_id uuid, expected_revision integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare locked uuid;
begin
  update public.ai_sessions set processing_until = now() + interval '3 minutes'
  where id = session_id and user_id = auth.uid() and revision = expected_revision
    and (processing_until is null or processing_until < now())
  returning id into locked;
  return locked is not null;
end;
$$;
revoke all on function public.lock_ai_session(uuid, integer) from public;
grant execute on function public.lock_ai_session(uuid, integer) to authenticated;
