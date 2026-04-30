alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin', 'manager', 'general'));

create table if not exists public.user_role_audit_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  previous_role text not null,
  new_role text not null,
  created_at timestamptz not null default now(),
  constraint user_role_audit_logs_previous_role_check
    check (previous_role in ('admin', 'manager', 'general')),
  constraint user_role_audit_logs_new_role_check
    check (new_role in ('admin', 'manager', 'general'))
);

create index if not exists user_role_audit_logs_target_user_id_idx
  on public.user_role_audit_logs (target_user_id);

create index if not exists user_role_audit_logs_actor_user_id_idx
  on public.user_role_audit_logs (actor_user_id);

alter table public.user_role_audit_logs enable row level security;

revoke all on table public.user_role_audit_logs from public, anon, authenticated;

create or replace function public.update_user_profile_role(
  p_target_user_id uuid,
  p_new_role text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_previous_role text;
  v_admin_count integer;
begin
  if p_target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if p_actor_user_id is null then
    raise exception 'actor_user_id is required';
  end if;

  if p_new_role not in ('admin', 'manager', 'general') then
    raise exception 'invalid role';
  end if;

  lock table public.user_profiles in exclusive mode;

  select role
    into v_actor_role
  from public.user_profiles
  where id = p_actor_user_id;

  if v_actor_role is distinct from 'admin' then
    raise exception 'permission denied';
  end if;

  select role
    into v_previous_role
  from public.user_profiles
  where id = p_target_user_id;

  if v_previous_role is null then
    raise exception 'target user not found';
  end if;

  if v_previous_role = 'admin' and p_new_role <> 'admin' then
    select count(*)
      into v_admin_count
    from public.user_profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'last admin cannot be demoted';
    end if;
  end if;

  if v_previous_role = p_new_role then
    return p_target_user_id;
  end if;

  update public.user_profiles
  set role = p_new_role
  where id = p_target_user_id;

  insert into public.user_role_audit_logs (
    target_user_id,
    actor_user_id,
    previous_role,
    new_role
  )
  values (
    p_target_user_id,
    p_actor_user_id,
    v_previous_role,
    p_new_role
  );

  return p_target_user_id;
end;
$$;

revoke execute on function public.update_user_profile_role(
  uuid,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.update_user_profile_role(
  uuid,
  text,
  uuid
) to service_role;
