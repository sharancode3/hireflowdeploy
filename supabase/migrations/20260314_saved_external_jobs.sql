begin;

create extension if not exists pgcrypto;

create table if not exists public.saved_external_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_job_id uuid not null references public.external_jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, external_job_id)
);

create index if not exists idx_saved_external_jobs_user_id on public.saved_external_jobs(user_id, created_at desc);
create index if not exists idx_saved_external_jobs_external_job_id on public.saved_external_jobs(external_job_id);

alter table public.saved_external_jobs enable row level security;

drop policy if exists saved_external_jobs_select_own on public.saved_external_jobs;
create policy saved_external_jobs_select_own on public.saved_external_jobs
  for select using (user_id = auth.uid());

drop policy if exists saved_external_jobs_insert_own on public.saved_external_jobs;
create policy saved_external_jobs_insert_own on public.saved_external_jobs
  for insert with check (user_id = auth.uid() and public.current_user_role() = 'JOB_SEEKER');

drop policy if exists saved_external_jobs_delete_own on public.saved_external_jobs;
create policy saved_external_jobs_delete_own on public.saved_external_jobs
  for delete using (user_id = auth.uid());

commit;
