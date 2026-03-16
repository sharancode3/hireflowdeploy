begin;

-- Enforce recruiter-facing essentials for profile and job publishing paths.
create or replace function public.guard_recruiter_profile_required_fields()
returns trigger
language plpgsql
as $$
begin
  new.company_name = btrim(coalesce(new.company_name, ''));
  if char_length(new.company_name) < 2 then
    raise exception 'company_name must be at least 2 characters';
  end if;

  if new.company_website is not null then
    new.company_website = nullif(btrim(new.company_website), '');
  end if;

  if new.designation is not null then
    new.designation = nullif(btrim(new.designation), '');
  end if;

  if new.bio is not null then
    new.bio = nullif(btrim(new.bio), '');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_recruiter_profiles_required_fields_guard on public.recruiter_profiles;
create trigger trg_recruiter_profiles_required_fields_guard
before insert or update of company_name, company_website, designation, bio on public.recruiter_profiles
for each row
execute function public.guard_recruiter_profile_required_fields();

create or replace function public.guard_recruiter_job_required_fields()
returns trigger
language plpgsql
as $$
begin
  new.title = btrim(coalesce(new.title, ''));
  new.company_name = btrim(coalesce(new.company_name, ''));
  new.location = btrim(coalesce(new.location, ''));
  new.role = btrim(coalesce(new.role, ''));
  new.description = btrim(coalesce(new.description, ''));

  if char_length(new.title) = 0 then
    raise exception 'title is required';
  end if;
  if char_length(new.company_name) = 0 then
    raise exception 'company_name is required';
  end if;
  if char_length(new.location) = 0 then
    raise exception 'location is required';
  end if;
  if char_length(new.role) = 0 then
    raise exception 'role is required';
  end if;
  if char_length(new.description) = 0 then
    raise exception 'description is required';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_required_fields_guard on public.jobs;
create trigger trg_jobs_required_fields_guard
before insert or update of title, company_name, location, role, description on public.jobs
for each row
execute function public.guard_recruiter_job_required_fields();

commit;
