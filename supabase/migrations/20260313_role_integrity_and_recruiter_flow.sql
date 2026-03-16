begin;

-- Keep recruiter status consistent with role.
alter table public.profiles
  alter column recruiter_approval_status set default 'PENDING';

update public.profiles
set recruiter_approval_status = 'PENDING'
where role = 'RECRUITER' and recruiter_approval_status is null;

alter table public.profiles
  drop constraint if exists profiles_recruiter_status_role_check;

alter table public.profiles
  add constraint profiles_recruiter_status_role_check
  check (
    (role = 'RECRUITER' and recruiter_approval_status in ('PENDING', 'APPROVED', 'REJECTED'))
    or (role = 'JOB_SEEKER' and recruiter_approval_status is null)
  );

-- Enforce role integrity for role-specific profile tables.
create or replace function public.ensure_recruiter_profile_role()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.user_id
      and p.role = 'RECRUITER'
  ) then
    raise exception 'recruiter_profiles.user_id must reference a RECRUITER profile';
  end if;
  return new;
end;
$$;

create or replace function public.ensure_job_seeker_profile_role()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.user_id
      and p.role = 'JOB_SEEKER'
  ) then
    raise exception 'job_seeker_profiles.user_id must reference a JOB_SEEKER profile';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recruiter_profiles_role_guard on public.recruiter_profiles;
create trigger trg_recruiter_profiles_role_guard
before insert or update on public.recruiter_profiles
for each row execute function public.ensure_recruiter_profile_role();

drop trigger if exists trg_job_seeker_profiles_role_guard on public.job_seeker_profiles;
create trigger trg_job_seeker_profiles_role_guard
before insert or update on public.job_seeker_profiles
for each row execute function public.ensure_job_seeker_profile_role();

-- Enforce relationship integrity for jobs/applications even when service-role writes bypass RLS.
create or replace function public.ensure_job_recruiter_integrity()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.recruiter_id
      and p.role = 'RECRUITER'
      and p.recruiter_approval_status = 'APPROVED'
  ) then
    raise exception 'jobs.recruiter_id must reference an APPROVED recruiter';
  end if;
  return new;
end;
$$;

create or replace function public.ensure_application_integrity()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.job_seeker_id
      and p.role = 'JOB_SEEKER'
  ) then
    raise exception 'applications.job_seeker_id must reference a JOB_SEEKER profile';
  end if;

  if not exists (
    select 1
    from public.jobs j
    where j.id = new.job_id
      and j.review_status = 'APPROVED'
  ) then
    raise exception 'applications.job_id must reference an APPROVED job';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_recruiter_integrity on public.jobs;
create trigger trg_jobs_recruiter_integrity
before insert or update on public.jobs
for each row execute function public.ensure_job_recruiter_integrity();

drop trigger if exists trg_applications_integrity on public.applications;
create trigger trg_applications_integrity
before insert or update on public.applications
for each row execute function public.ensure_application_integrity();

-- Recruiters can view job seeker profile details for candidates who applied to their jobs.
drop policy if exists job_seeker_profiles_select_recruiter_for_applicants on public.job_seeker_profiles;
create policy job_seeker_profiles_select_recruiter_for_applicants on public.job_seeker_profiles
  for select using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.job_seeker_id = job_seeker_profiles.user_id
        and j.recruiter_id = auth.uid()
    )
  );

-- Admin can view seeker profile data for platform moderation and cross-role visibility.
drop policy if exists job_seeker_profiles_select_admin on public.job_seeker_profiles;
create policy job_seeker_profiles_select_admin on public.job_seeker_profiles
  for select using (public.is_admin_email());

-- Helpful read model for admin dashboards and audits.
create or replace view public.admin_user_directory as
select
  p.id,
  p.email,
  p.role,
  p.recruiter_approval_status,
  p.full_name,
  p.phone,
  p.location,
  rp.company_name,
  rp.company_website,
  jsp.experience_years,
  jsp.skills,
  p.created_at,
  p.updated_at
from public.profiles p
left join public.recruiter_profiles rp on rp.user_id = p.id
left join public.job_seeker_profiles jsp on jsp.user_id = p.id;

commit;
