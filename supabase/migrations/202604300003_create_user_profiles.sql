create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_not_blank check (btrim(username) <> ''),
  constraint user_profiles_role_check check (role in ('general'))
);

create index if not exists user_profiles_username_idx
  on public.user_profiles (username);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_user_profiles_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);

revoke all on table public.user_profiles from public, anon, authenticated;
grant select on table public.user_profiles to authenticated;
