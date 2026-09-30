begin;

create or replace function public.creavy_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.creavy_is_admin() from public;
grant execute on function public.creavy_is_admin() to authenticated;
drop policy if exists "Administrators read AI conversations" on public.ai_sessions;
create policy "Administrators read AI conversations" on public.ai_sessions for select to authenticated using (public.creavy_is_admin());

create table if not exists public.ai_session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions(id) on delete cascade,
  revision integer not null,
  entry_number integer not null,
  role text not null check(role in ('user','assistant')),
  text text not null, payload jsonb,
  created_at timestamptz not null default now(),
  unique(session_id,revision,entry_number)
);
alter table public.ai_session_messages enable row level security;
drop policy if exists "Owners and administrators read AI transcript" on public.ai_session_messages;
create policy "Owners and administrators read AI transcript" on public.ai_session_messages for select to authenticated
  using (exists(select 1 from public.ai_sessions where id = session_id and (user_id = auth.uid() or public.creavy_is_admin())));
drop policy if exists "Owners append AI transcript" on public.ai_session_messages;
create policy "Owners append AI transcript" on public.ai_session_messages for insert to authenticated
  with check (exists(select 1 from public.ai_sessions where id = session_id and user_id = auth.uid()));
grant select, insert on public.ai_session_messages to authenticated;

create or replace function public.save_ai_session(session_id uuid, expected_revision integer, new_state jsonb, entries jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare changed public.ai_sessions;
begin
  update public.ai_sessions set state = new_state, revision = revision + 1, updated_at = now(), processing_until = null
    where id = session_id and user_id = auth.uid() and revision = expected_revision returning * into changed;
  if not found then raise exception 'Conversation changed' using errcode = '40001'; end if;
  insert into public.ai_session_messages(session_id,revision,entry_number,role,text,payload)
    select changed.id, changed.revision, ordinality::integer, item->>'role', item->>'text', item->'payload'
    from jsonb_array_elements(entries) with ordinality as records(item,ordinality);
  return to_jsonb(changed);
end;
$$;
revoke all on function public.save_ai_session(uuid,integer,jsonb,jsonb) from public;
grant execute on function public.save_ai_session(uuid,integer,jsonb,jsonb) to authenticated;

create table if not exists public.admin_ai_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.ai_sessions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('edit','transfer','role')),
  before_data jsonb not null,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.admin_ai_events enable row level security;
drop policy if exists "Administrators read AI audit" on public.admin_ai_events;
create policy "Administrators read AI audit" on public.admin_ai_events for select to authenticated using (public.creavy_is_admin());
revoke all on public.admin_ai_events from anon, authenticated;
grant select on public.admin_ai_events to authenticated;

create table if not exists public.ai_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.ai_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('private','custom','public')),
  recipient_ids uuid[] not null default '{}',
  document jsonb not null,
  resources jsonb not null default '[]',
  mode text not null check (mode in ('explore','focus')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.ai_shares enable row level security;
drop policy if exists "Shared AI results are visible to recipients" on public.ai_shares;
create policy "Shared AI results are visible to recipients" on public.ai_shares for select to anon, authenticated
  using (visibility = 'public' or user_id = auth.uid() or (visibility = 'custom' and auth.uid() = any(recipient_ids)));
drop policy if exists "Authors create AI shares" on public.ai_shares;
create policy "Authors create AI shares" on public.ai_shares for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Authors update AI shares" on public.ai_shares;
create policy "Authors update AI shares" on public.ai_shares for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select on public.ai_shares to anon, authenticated;
grant insert, update on public.ai_shares to authenticated;

create or replace function public.guard_ai_share_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.ai_sessions where id = new.session_id and user_id = new.user_id) then
    raise exception 'Only the conversation owner can share its result' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_ai_share_owner on public.ai_shares;
create trigger guard_ai_share_owner before insert or update on public.ai_shares for each row execute function public.guard_ai_share_owner();

create or replace function public.admin_edit_ai_session(session_id uuid, expected_revision integer, new_state jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare original public.ai_sessions; changed public.ai_sessions;
begin
  if not public.creavy_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into original from public.ai_sessions where id = session_id for update;
  if not found then raise exception 'Conversation not found'; end if;
  if original.revision <> expected_revision or original.processing_until > now() then raise exception 'Conversation changed or is processing' using errcode = '40001'; end if;
  if coalesce(jsonb_typeof(new_state), '') <> 'object' or coalesce(jsonb_typeof(new_state->'answers'), '') <> 'array'
    or coalesce(length(new_state->>'seed'), 0) not between 5 and 8000
    or coalesce(new_state->>'phase', '') not in ('questions','confirm','review') or octet_length(new_state::text) > 200000 then raise exception 'Invalid conversation state'; end if;
  update public.ai_sessions set state = new_state, revision = revision + 1, updated_at = now(), processing_until = null where id = session_id returning * into changed;
  insert into public.admin_ai_events(session_id,actor_id,action,before_data,after_data)
    values(session_id,auth.uid(),'edit',jsonb_build_object('state',original.state,'revision',original.revision),jsonb_build_object('state',changed.state,'revision',changed.revision));
  return to_jsonb(changed);
end;
$$;
revoke all on function public.admin_edit_ai_session(uuid,integer,jsonb) from public;
grant execute on function public.admin_edit_ai_session(uuid,integer,jsonb) to authenticated;

create or replace function public.admin_move_ai_session(session_id uuid, expected_revision integer, recipient_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare original public.ai_sessions; changed public.ai_sessions;
begin
  if not public.creavy_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into original from public.ai_sessions where id = session_id for update;
  if not found then raise exception 'Conversation not found'; end if;
  if original.revision <> expected_revision or original.processing_until > now() then raise exception 'Conversation changed or is processing' using errcode = '40001'; end if;
  if not exists(select 1 from public.profiles where id = recipient_id) then raise exception 'Recipient not found'; end if;
  if original.user_id = recipient_id then raise exception 'Choose a different owner'; end if;
  update public.ai_sessions set user_id = recipient_id, revision = revision + 1, updated_at = now(), processing_until = null where id = session_id returning * into changed;
  -- A transfer never silently exposes an existing publication to the previous audience.
  update public.ai_shares set user_id = recipient_id, visibility = 'private', recipient_ids = '{}', updated_at = now() where ai_shares.session_id = admin_move_ai_session.session_id;
  insert into public.admin_ai_events(session_id,actor_id,action,before_data,after_data)
    values(session_id,auth.uid(),'transfer',jsonb_build_object('user_id',original.user_id,'revision',original.revision),jsonb_build_object('user_id',changed.user_id,'revision',changed.revision));
  return to_jsonb(changed);
end;
$$;
revoke all on function public.admin_move_ai_session(uuid,integer,uuid) from public;
grant execute on function public.admin_move_ai_session(uuid,integer,uuid) to authenticated;

create or replace function public.guard_profile_admin_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not coalesce(new.is_admin,false) then return new; end if;
    if auth.uid() is not null and not public.creavy_is_admin() or coalesce(current_setting('request.jwt.claim.role', true),'') = 'anon' then
      raise exception 'Administrator access required' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.is_admin is not distinct from old.is_admin then return new; end if;
  if auth.uid() is not null then
    if not public.creavy_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
    if auth.uid() = old.id then raise exception 'Cannot change your own administrator role'; end if;
  elsif coalesce(current_setting('request.jwt.claim.role', true),'') in ('anon','authenticated') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(731004);
  if old.is_admin and not coalesce(new.is_admin,false) and not exists(select 1 from public.profiles where is_admin and id <> old.id) then raise exception 'At least one administrator must remain'; end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_admin_role on public.profiles;
create trigger guard_profile_admin_role before insert or update of is_admin on public.profiles for each row execute function public.guard_profile_admin_role();

create or replace function public.admin_set_member_role(member_id uuid, admin_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare previous boolean;
begin
  if not public.creavy_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select is_admin into previous from public.profiles where id = member_id for update;
  if not found then raise exception 'User not found'; end if;
  update public.profiles set is_admin = admin_value where id = member_id;
  insert into public.admin_ai_events(actor_id,action,before_data,after_data)
    values(auth.uid(),'role',jsonb_build_object('user_id',member_id,'is_admin',previous),jsonb_build_object('user_id',member_id,'is_admin',admin_value));
end;
$$;
revoke all on function public.admin_set_member_role(uuid,boolean) from public;
grant execute on function public.admin_set_member_role(uuid,boolean) to authenticated;

create table if not exists public.report_card_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  color text not null default 'neutral' check(color in ('neutral','blue','green','amber','rose','violet')),
  primary key(user_id,report_id)
);
alter table public.report_card_preferences enable row level security;
drop policy if exists "Personal card colors" on public.report_card_preferences;
create policy "Personal card colors" on public.report_card_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists(select 1 from public.reports where id = report_id));
grant select, insert, update, delete on public.report_card_preferences to authenticated;

commit;
