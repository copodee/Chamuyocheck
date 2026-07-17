-- ChamuyoCheck - usuarios registrados, beta completa y cobros futuros desactivados.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'beta_full',
  access_mode text not null default 'beta_full',
  analysis_used integer not null default 0,
  billing_provider text not null default 'google-pay-gateway',
  billing_customer_id text,
  subscription_status text not null default 'inactive',
  preferred_wallet text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.profiles add column if not exists access_mode text not null default 'beta_full';
alter table public.profiles add column if not exists billing_provider text not null default 'google-pay-gateway';
alter table public.profiles add column if not exists billing_customer_id text;
alter table public.profiles add column if not exists subscription_status text not null default 'inactive';
alter table public.profiles add column if not exists preferred_wallet text;
alter table public.profiles add column if not exists updated_at timestamp with time zone not null default now();
alter table public.profiles alter column plan set default 'beta_full';
alter table public.profiles alter column billing_provider set default 'google-pay-gateway';

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text,
  document_type text,
  input_type text,
  score integer,
  summary text,
  result jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own analyses" on public.analyses;
drop policy if exists "Users can insert own analyses" on public.analyses;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can read own analyses"
on public.analyses for select
using (auth.uid() = user_id);

create policy "Users can insert own analyses"
on public.analyses for insert
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, plan, access_mode)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'beta_full',
    'beta_full'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.record_analysis_usage()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, email, plan, access_mode, analysis_used, updated_at)
  select id, email, 'beta_full', 'beta_full', 1, now()
  from auth.users
  where id = auth.uid()
  on conflict (id) do update
  set analysis_used = public.profiles.analysis_used + 1,
      updated_at = now();
end;
$$;

revoke all on function public.record_analysis_usage() from public;
revoke all on function public.record_analysis_usage() from anon;
grant execute on function public.record_analysis_usage() to authenticated;
