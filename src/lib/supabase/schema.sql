-- ChamuyoCheck V15 Beta - Supabase schema

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  plan text default 'starter',
  analysis_used integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  title text,
  document_type text,
  input_type text,
  score integer,
  summary text,
  result jsonb,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Users can read own analyses"
on public.analyses for select
using (auth.uid() = user_id);

create policy "Users can insert own analyses"
on public.analyses for insert
with check (auth.uid() = user_id);
