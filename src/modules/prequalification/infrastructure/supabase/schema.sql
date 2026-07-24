-- LeasingScoring Precalificación: ejecutar únicamente en su Supabase exclusivo.
-- Auth > Providers > Email: desactivar "Allow new users to sign up".

create extension if not exists pgcrypto;
create sequence if not exists public.prequal_case_number_seq;

create or replace function public.next_prequal_case_number()
returns text language sql volatile set search_path = ''
as $$
  select 'LS-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.prequal_case_number_seq')::text, 6, '0');
$$;

create table if not exists public.prequal_organizations (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default public.next_prequal_case_number(),
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
  stage integer not null default 1 check (stage between 1 and 3),
  contact jsonb,
  economic_inputs jsonb,
  economic_assessment jsonb,
  documents jsonb not null default '[]'::jsonb,
  compliance jsonb,
  stage3_decision text,
  response_email text,
  administrator_email text,
  email_provider text not null default 'pending',
  notification_status text not null default 'not-configured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prequal_cases add column if not exists case_number text;
alter table public.prequal_cases add column if not exists stage integer not null default 1;
alter table public.prequal_cases add column if not exists contact jsonb;
alter table public.prequal_cases add column if not exists economic_inputs jsonb;
alter table public.prequal_cases add column if not exists economic_assessment jsonb;
alter table public.prequal_cases add column if not exists documents jsonb not null default '[]'::jsonb;
alter table public.prequal_cases add column if not exists compliance jsonb;
alter table public.prequal_cases add column if not exists stage3_decision text;
alter table public.prequal_cases add column if not exists response_email text;
alter table public.prequal_cases add column if not exists administrator_email text;
alter table public.prequal_cases add column if not exists email_provider text not null default 'pending';
alter table public.prequal_cases add column if not exists notification_status text not null default 'not-configured';
alter table public.prequal_cases add column if not exists updated_at timestamptz not null default now();
update public.prequal_cases set case_number = public.next_prequal_case_number() where case_number is null;
create unique index if not exists prequal_cases_case_number_key on public.prequal_cases(case_number);

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

create or replace function public.get_prequal_access()
returns table (organization_id uuid, role text)
language sql stable security definer set search_path = ''
as $$
  select membership.organization_id, membership.role
  from public.prequal_memberships as membership
  where membership.user_id = auth.uid()
    and membership.active = true
  limit 1;
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

drop policy if exists "members update prequalifications" on public.prequal_cases;
create policy "members update prequalifications" on public.prequal_cases
for update using (public.is_active_member(organization_id))
with check (public.is_active_member(organization_id));

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
revoke all on function public.get_prequal_access() from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.is_administrator(uuid) to authenticated;
grant execute on function public.get_prequal_access() to authenticated;
grant usage, select on sequence public.prequal_case_number_seq to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prequalification-documents',
  'prequalification-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload prequalification documents" on storage.objects;
create policy "members upload prequalification documents" on storage.objects
for insert to authenticated with check (
  bucket_id = 'prequalification-documents'
  and public.is_active_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "members read prequalification documents" on storage.objects;
create policy "members read prequalification documents" on storage.objects
for select to authenticated using (
  bucket_id = 'prequalification-documents'
  and public.is_active_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "members delete prequalification documents" on storage.objects;
create policy "members delete prequalification documents" on storage.objects
for delete to authenticated using (
  bucket_id = 'prequalification-documents'
  and public.is_active_member(((storage.foldername(name))[1])::uuid)
);

-- Tras crear el primer usuario desde Authentication > Users:
-- insert into public.prequal_organizations (name) values ('LeasingScoring Administración') returning id;
-- insert into public.prequal_memberships (user_id, organization_id, role)
-- values ('UUID_DEL_USUARIO', 'UUID_DE_LA_ORGANIZACION', 'administrator');
