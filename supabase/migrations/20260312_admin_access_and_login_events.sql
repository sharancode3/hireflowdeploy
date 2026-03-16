begin;

-- Admin allowlist helper based on authenticated email claim.
create or replace function public.is_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) in (
    'sharan18x@gmail.com'
  );
$$;

-- Login activity tracking for admin dashboard.
create table if not exists public.user_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'web',
  logged_in_at timestamptz not null default now()
);

create index if not exists idx_user_login_events_user_id on public.user_login_events(user_id);
create index if not exists idx_user_login_events_logged_in_at on public.user_login_events(logged_in_at desc);

alter table public.user_login_events enable row level security;

drop policy if exists user_login_events_insert_own on public.user_login_events;
create policy user_login_events_insert_own on public.user_login_events
  for insert with check (user_id = auth.uid());

drop policy if exists user_login_events_select_own_or_admin on public.user_login_events;
create policy user_login_events_select_own_or_admin on public.user_login_events
  for select using (user_id = auth.uid() or public.is_admin_email());

-- Admin visibility + update powers for moderation workflows.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin_email());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin_email()) with check (public.is_admin_email());

drop policy if exists recruiter_profiles_select_admin on public.recruiter_profiles;
create policy recruiter_profiles_select_admin on public.recruiter_profiles
  for select using (public.is_admin_email());

drop policy if exists applications_select_admin on public.applications;
create policy applications_select_admin on public.applications
  for select using (public.is_admin_email());

drop policy if exists applications_update_admin on public.applications;
create policy applications_update_admin on public.applications
  for update using (public.is_admin_email()) with check (public.is_admin_email());

drop policy if exists jobs_select_admin on public.jobs;
create policy jobs_select_admin on public.jobs
  for select using (public.is_admin_email());

drop policy if exists jobs_update_admin on public.jobs;
create policy jobs_update_admin on public.jobs
  for update using (public.is_admin_email()) with check (public.is_admin_email());

commit;
