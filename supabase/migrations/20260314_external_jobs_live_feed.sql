begin;

create extension if not exists pgcrypto;

create table if not exists public.external_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  dedupe_key text not null,
  title text not null,
  company text not null,
  location_city text,
  location_state text,
  location_country text not null default 'Global',
  is_remote boolean not null default false,
  is_hybrid boolean not null default false,
  is_onsite boolean not null default true,
  job_type text not null check (job_type in ('full_time', 'part_time', 'internship', 'contract', 'freelance')),
  experience_level text not null default 'any',
  min_experience_years integer not null default 0,
  skills text[] not null default '{}',
  salary_min numeric,
  salary_max numeric,
  salary_currency text not null default 'USD',
  apply_url text not null,
  description text not null default '',
  posted_at timestamptz not null,
  application_deadline timestamptz,
  active_until timestamptz not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_external_jobs_dedupe_key on public.external_jobs(dedupe_key);
create unique index if not exists uq_external_jobs_source_external_id on public.external_jobs(source, external_id);
create index if not exists idx_external_jobs_active on public.external_jobs(is_active, active_until desc, posted_at desc);
create index if not exists idx_external_jobs_job_type on public.external_jobs(job_type, posted_at desc);
create index if not exists idx_external_jobs_experience_level on public.external_jobs(experience_level, posted_at desc);
create index if not exists idx_external_jobs_skills_gin on public.external_jobs using gin (skills);

drop trigger if exists trg_external_jobs_updated_at on public.external_jobs;

create trigger trg_external_jobs_updated_at
before update on public.external_jobs
for each row execute function public.set_updated_at();

commit;
