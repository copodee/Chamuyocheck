-- LeasingScoring Precalificación: ejecutar únicamente en su Supabase exclusivo.
-- Auth > Providers > Email: desactivar "Allow new users to sign up".

create extension if not exists pgcrypto;

create table if not exists public.prequal_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.prequal_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.prequal_organizations(id) on delete cascade,
  role text not null check (role in ('administrator', 'analyst', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table if not exists public.prequal_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.prequal_organizations(id),
  created_by uuid not null references auth.users(id),
  subject_hash text not null,
  client_type text not null,
  asset_type text not null,
  asset_value numeric(18,2) not null,
  advance numeric(18,2) not null default 0,
  term_months integer not null,
  status text not null,
  score integer not null,
  model_version text not null,
  provider text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prequal_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.prequal_organizations(id),
  actor_id uuid references auth.users(id),
  event_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.prequal_organizations enable row level security;
alter table public.prequal_memberships enable row level security;
alter table public.prequal_cases enable row level security;
alter table public.prequal_audit_events enable row level security;

create or replace function public.is_active_member(target_organization uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.prequal_memberships
    where user_id = auth.uid()
      and organization_id = target_organization
      and active = true
  );
$$;

create or replace function public.is_administrator(target_organization uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.prequal_memberships
    where user_id = auth.uid()
      and organization_id = target_organization
      and role = 'administrator'
      and active = true
  );
$$;

drop policy if exists "members read organizations" on public.prequal_organizations;
create policy "members read organizations" on public.prequal_organizations
for select using (public.is_active_member(id));

drop policy if exists "members read memberships" on public.prequal_memberships;
create policy "members read memberships" on public.prequal_memberships
for select using (public.is_active_member(organization_id));

drop policy if exists "administrators manage memberships" on public.prequal_memberships;
create policy "administrators manage memberships" on public.prequal_memberships
for all using (public.is_administrator(organization_id))
with check (public.is_administrator(organization_id));

drop policy if exists "members insert prequalifications" on public.prequal_cases;
create policy "members insert prequalifications" on public.prequal_cases
for insert with check (
  auth.uid() = created_by and public.is_active_member(organization_id)
);

drop policy if exists "members read prequalifications" on public.prequal_cases;
create policy "members read prequalifications" on public.prequal_cases
for select using (public.is_active_member(organization_id));

drop policy if exists "members read audit" on public.prequal_audit_events;
create policy "members read audit" on public.prequal_audit_events
for select using (public.is_active_member(organization_id));

drop policy if exists "members insert audit" on public.prequal_audit_events;
create policy "members insert audit" on public.prequal_audit_events
for insert with check (
  auth.uid() = actor_id and public.is_active_member(organization_id)
);

revoke all on function public.is_active_member(uuid) from public, anon;
revoke all on function public.is_administrator(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.is_administrator(uuid) to authenticated;

-- Tras crear el primer usuario desde Authentication > Users:
-- insert into public.prequal_organizations (name) values ('LeasingScoring Administración') returning id;
-- insert into public.prequal_memberships (user_id, organization_id, role)
-- values ('UUID_DEL_USUARIO', 'UUID_DE_LA_ORGANIZACION', 'administrator');
