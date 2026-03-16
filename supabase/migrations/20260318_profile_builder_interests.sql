begin;

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interest_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interests enable row level security;

create policy if not exists "select_interests" on public.interests for select using (auth.uid() = user_id);
create policy if not exists "insert_interests" on public.interests for insert with check (auth.uid() = user_id);
create policy if not exists "update_interests" on public.interests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_interests" on public.interests for delete using (auth.uid() = user_id);

commit;
