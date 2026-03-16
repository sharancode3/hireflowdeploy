-- Hireflow core schema (Supabase / Postgres)
-- Run this once in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- Shared trigger function for updated_at columns.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Master user profile table mapped to Supabase auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('JOB_SEEKER', 'RECRUITER')),
  full_name text not null,
  phone text,
  location text,
  headline text,
  about text,
  avatar_url text,
  recruiter_approval_status text check (recruiter_approval_status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Helper: current app role from profiles.
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: approved recruiter check.
create or replace function public.is_approved_recruiter()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'RECRUITER'
      and p.recruiter_approval_status = 'APPROVED'
  );
$$;

create table if not exists public.job_seeker_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  experience_years integer not null default 0 check (experience_years >= 0 and experience_years <= 60),
  desired_role text,
  skills text[] not null default '{}',
  is_fresher boolean not null default false,
  visibility text not null default 'PUBLIC' check (visibility in ('PUBLIC', 'PRIVATE')),
  active_generated_resume_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_job_seeker_profiles_updated_at
before update on public.job_seeker_profiles
for each row execute function public.set_updated_at();

create table if not exists public.recruiter_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null,
  company_website text,
  designation text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_recruiter_profiles_updated_at
before update on public.recruiter_profiles
for each row execute function public.set_updated_at();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company_name text not null,
  location text not null,
  role text not null,
  required_skills text[] not null default '{}',
  job_type text not null check (job_type in ('FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT')),
  min_experience_years integer not null default 0 check (min_experience_years >= 0 and min_experience_years <= 60),
  description text not null,
  open_to_freshers boolean not null default false,
  review_status text not null default 'PENDING_REVIEW' check (review_status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION')),
  admin_feedback text,
  reviewed_at timestamptz,
  application_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_recruiter_id on public.jobs(recruiter_id);
create index if not exists idx_jobs_review_status on public.jobs(review_status);
create index if not exists idx_jobs_created_at on public.jobs(created_at desc);

create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'APPLIED' check (status in ('APPLIED', 'SHORTLISTED', 'REJECTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'HIRED')),
  cover_letter text,
  interview_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, job_seeker_id)
);

create index if not exists idx_applications_job_id on public.applications(job_id);
create index if not exists idx_applications_job_seeker_id on public.applications(job_seeker_id);
create index if not exists idx_applications_status on public.applications(status);

create trigger trg_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, job_seeker_id)
);

create index if not exists idx_saved_jobs_job_seeker_id on public.saved_jobs(job_seeker_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  original_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_resumes_job_seeker_id on public.resumes(job_seeker_id);

create table if not exists public.generated_resumes (
  id uuid primary key default gen_random_uuid(),
  job_seeker_id uuid not null references public.profiles(id) on delete cascade,
  template text not null,
  title text not null,
  snapshot jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_generated_resumes_job_seeker_id on public.generated_resumes(job_seeker_id);

create trigger trg_generated_resumes_updated_at
before update on public.generated_resumes
for each row execute function public.set_updated_at();

alter table public.job_seeker_profiles
  add constraint fk_job_seeker_active_generated_resume
  foreign key (active_generated_resume_id)
  references public.generated_resumes(id)
  on delete set null;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  category text not null default 'GENERAL',
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_community_posts_author_id on public.community_posts(author_id);
create index if not exists idx_community_posts_created_at on public.community_posts(created_at desc);

create trigger trg_community_posts_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

create table if not exists public.complaint_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  description text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_complaint_tickets_created_by on public.complaint_tickets(created_by);
create index if not exists idx_complaint_tickets_status on public.complaint_tickets(status);

create trigger trg_complaint_tickets_updated_at
before update on public.complaint_tickets
for each row execute function public.set_updated_at();

create table if not exists public.interview_prep_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null,
  score integer not null default 0 check (score >= 0 and score <= 100),
  completed_topics text[] not null default '{}',
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, track)
);

create index if not exists idx_interview_prep_progress_user_id on public.interview_prep_progress(user_id);

create trigger trg_interview_prep_progress_updated_at
before update on public.interview_prep_progress
for each row execute function public.set_updated_at();

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system',
  notifications_enabled boolean not null default true,
  email_updates boolean not null default true,
  density text not null default 'comfortable',
  command_palette_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.job_seeker_profiles enable row level security;
alter table public.recruiter_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.resumes enable row level security;
alter table public.generated_resumes enable row level security;
alter table public.community_posts enable row level security;
alter table public.complaint_tickets enable row level security;
alter table public.interview_prep_progress enable row level security;
alter table public.user_settings enable row level security;

-- profiles
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- job seeker profiles
create policy job_seeker_profiles_select_own on public.job_seeker_profiles
  for select using (user_id = auth.uid());

create policy job_seeker_profiles_insert_own on public.job_seeker_profiles
  for insert with check (user_id = auth.uid());

create policy job_seeker_profiles_update_own on public.job_seeker_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- recruiter profiles
create policy recruiter_profiles_select_own on public.recruiter_profiles
  for select using (user_id = auth.uid());

create policy recruiter_profiles_insert_own on public.recruiter_profiles
  for insert with check (user_id = auth.uid());

create policy recruiter_profiles_update_own on public.recruiter_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- jobs
create policy jobs_select_public_or_owner on public.jobs
  for select
  using (review_status = 'APPROVED' or recruiter_id = auth.uid());

create policy jobs_insert_recruiter on public.jobs
  for insert
  with check (
    recruiter_id = auth.uid()
    and public.is_approved_recruiter()
  );

create policy jobs_update_owner on public.jobs
  for update
  using (recruiter_id = auth.uid())
  with check (recruiter_id = auth.uid());

create policy jobs_delete_owner on public.jobs
  for delete
  using (recruiter_id = auth.uid());

-- applications
create policy applications_select_own_or_job_owner on public.applications
  for select
  using (
    job_seeker_id = auth.uid()
    or exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.recruiter_id = auth.uid()
    )
  );

create policy applications_insert_job_seeker on public.applications
  for insert
  with check (
    job_seeker_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.review_status = 'APPROVED'
    )
    and public.current_user_role() = 'JOB_SEEKER'
  );

create policy applications_update_job_owner on public.applications
  for update
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.recruiter_id = auth.uid()
    )
  );

-- saved jobs
create policy saved_jobs_select_own on public.saved_jobs
  for select using (job_seeker_id = auth.uid());

create policy saved_jobs_insert_own on public.saved_jobs
  for insert with check (job_seeker_id = auth.uid() and public.current_user_role() = 'JOB_SEEKER');

create policy saved_jobs_delete_own on public.saved_jobs
  for delete using (job_seeker_id = auth.uid());

-- notifications
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- resumes
create policy resumes_select_own on public.resumes
  for select using (job_seeker_id = auth.uid());

create policy resumes_insert_own on public.resumes
  for insert with check (job_seeker_id = auth.uid() and public.current_user_role() = 'JOB_SEEKER');

create policy resumes_delete_own on public.resumes
  for delete using (job_seeker_id = auth.uid());

-- generated resumes
create policy generated_resumes_select_own on public.generated_resumes
  for select using (job_seeker_id = auth.uid());

create policy generated_resumes_insert_own on public.generated_resumes
  for insert with check (job_seeker_id = auth.uid() and public.current_user_role() = 'JOB_SEEKER');

create policy generated_resumes_update_own on public.generated_resumes
  for update using (job_seeker_id = auth.uid()) with check (job_seeker_id = auth.uid());

create policy generated_resumes_delete_own on public.generated_resumes
  for delete using (job_seeker_id = auth.uid());

-- community posts
create policy community_posts_select_all_auth on public.community_posts
  for select using (auth.uid() is not null);

create policy community_posts_insert_own on public.community_posts
  for insert with check (author_id = auth.uid());

create policy community_posts_update_own on public.community_posts
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy community_posts_delete_own on public.community_posts
  for delete using (author_id = auth.uid());

-- complaint tickets
create policy complaint_tickets_select_own_or_recruiter on public.complaint_tickets
  for select
  using (
    created_by = auth.uid()
    or public.current_user_role() = 'RECRUITER'
  );

create policy complaint_tickets_insert_own on public.complaint_tickets
  for insert with check (created_by = auth.uid());

create policy complaint_tickets_update_recruiter on public.complaint_tickets
  for update
  using (public.current_user_role() = 'RECRUITER');

-- interview prep progress
create policy interview_prep_progress_select_own on public.interview_prep_progress
  for select using (user_id = auth.uid());

create policy interview_prep_progress_insert_own on public.interview_prep_progress
  for insert with check (user_id = auth.uid());

create policy interview_prep_progress_update_own on public.interview_prep_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user settings
create policy user_settings_select_own on public.user_settings
  for select using (user_id = auth.uid());

create policy user_settings_insert_own on public.user_settings
  for insert with check (user_id = auth.uid());

create policy user_settings_update_own on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
