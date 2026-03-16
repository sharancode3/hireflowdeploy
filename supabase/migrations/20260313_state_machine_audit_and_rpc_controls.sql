begin;

-- Central audit stream for critical lifecycle updates.
create table if not exists public.integrity_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_source text not null default 'database',
  event_type text not null,
  entity_table text not null,
  entity_id uuid,
  previous_data jsonb not null default '{}'::jsonb,
  next_data jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_integrity_audit_events_entity on public.integrity_audit_events(entity_table, entity_id, created_at desc);
create index if not exists idx_integrity_audit_events_actor on public.integrity_audit_events(actor_user_id, created_at desc);

alter table public.integrity_audit_events enable row level security;

drop policy if exists integrity_audit_events_select_admin on public.integrity_audit_events;
create policy integrity_audit_events_select_admin on public.integrity_audit_events
  for select using (public.is_admin_email());

-- State machine guards.
create or replace function public.is_valid_recruiter_approval_transition(old_status text, next_status text)
returns boolean
language plpgsql
immutable
as $$
begin
  if old_status is null then
    return next_status in ('PENDING', 'APPROVED', 'REJECTED');
  end if;

  if old_status = next_status then
    return true;
  end if;

  if old_status = 'PENDING' and next_status in ('APPROVED', 'REJECTED') then
    return true;
  end if;

  if old_status = 'APPROVED' and next_status = 'REJECTED' then
    return true;
  end if;

  if old_status = 'REJECTED' and next_status = 'PENDING' then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.is_valid_application_status_transition(old_status text, next_status text)
returns boolean
language plpgsql
immutable
as $$
begin
  if old_status is null then
    return next_status in ('APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'HIRED');
  end if;

  if old_status = next_status then
    return true;
  end if;

  if old_status = 'APPLIED' and next_status in ('SHORTLISTED', 'REJECTED') then
    return true;
  end if;

  if old_status = 'SHORTLISTED' and next_status in ('INTERVIEW_SCHEDULED', 'REJECTED') then
    return true;
  end if;

  if old_status = 'INTERVIEW_SCHEDULED' and next_status in ('OFFERED', 'REJECTED') then
    return true;
  end if;

  if old_status = 'OFFERED' and next_status in ('HIRED', 'REJECTED') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.is_valid_job_review_transition(old_status text, next_status text)
returns boolean
language plpgsql
immutable
as $$
begin
  if old_status is null then
    return next_status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION');
  end if;

  if old_status = next_status then
    return true;
  end if;

  if old_status = 'PENDING_REVIEW' and next_status in ('APPROVED', 'REJECTED', 'NEEDS_REVISION') then
    return true;
  end if;

  if old_status = 'NEEDS_REVISION' and next_status = 'PENDING_REVIEW' then
    return true;
  end if;

  if old_status = 'REJECTED' and next_status = 'PENDING_REVIEW' then
    return true;
  end if;

  if old_status = 'APPROVED' and next_status in ('NEEDS_REVISION', 'REJECTED') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.guard_profile_recruiter_approval_transition()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'RECRUITER' and new.recruiter_approval_status is not null then
    if not public.is_valid_recruiter_approval_transition(old.recruiter_approval_status, new.recruiter_approval_status) then
      raise exception 'Invalid recruiter approval transition: % -> %', old.recruiter_approval_status, new.recruiter_approval_status;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_application_status_transition()
returns trigger
language plpgsql
as $$
begin
  if not public.is_valid_application_status_transition(old.status, new.status) then
    raise exception 'Invalid application status transition: % -> %', old.status, new.status;
  end if;

  if new.status = 'INTERVIEW_SCHEDULED' and new.interview_at is null then
    raise exception 'interview_at is required when status is INTERVIEW_SCHEDULED';
  end if;

  if new.status <> 'INTERVIEW_SCHEDULED' then
    new.interview_at = null;
  end if;

  return new;
end;
$$;

create or replace function public.guard_job_review_transition()
returns trigger
language plpgsql
as $$
begin
  if not public.is_valid_job_review_transition(old.review_status, new.review_status) then
    raise exception 'Invalid job review transition: % -> %', old.review_status, new.review_status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_approval_transition_guard on public.profiles;
create trigger trg_profiles_approval_transition_guard
before update of recruiter_approval_status on public.profiles
for each row
when (old.recruiter_approval_status is distinct from new.recruiter_approval_status)
execute function public.guard_profile_recruiter_approval_transition();

drop trigger if exists trg_applications_status_transition_guard on public.applications;
create trigger trg_applications_status_transition_guard
before update of status, interview_at on public.applications
for each row
when (old.status is distinct from new.status or old.interview_at is distinct from new.interview_at)
execute function public.guard_application_status_transition();

drop trigger if exists trg_jobs_review_transition_guard on public.jobs;
create trigger trg_jobs_review_transition_guard
before update of review_status on public.jobs
for each row
when (old.review_status is distinct from new.review_status)
execute function public.guard_job_review_transition();

-- Structured audit triggers for high-value changes.
create or replace function public.audit_recruiter_approval_change()
returns trigger
language plpgsql
as $$
begin
  insert into public.integrity_audit_events (
    actor_user_id,
    actor_source,
    event_type,
    entity_table,
    entity_id,
    previous_data,
    next_data,
    context
  ) values (
    auth.uid(),
    case when auth.uid() is null then 'service_role' else 'auth_user' end,
    'RECRUITER_APPROVAL_STATUS_CHANGED',
    'profiles',
    new.id,
    jsonb_build_object('role', old.role, 'recruiter_approval_status', old.recruiter_approval_status),
    jsonb_build_object('role', new.role, 'recruiter_approval_status', new.recruiter_approval_status),
    jsonb_build_object('email', new.email)
  );
  return new;
end;
$$;

create or replace function public.audit_application_status_change()
returns trigger
language plpgsql
as $$
begin
  insert into public.integrity_audit_events (
    actor_user_id,
    actor_source,
    event_type,
    entity_table,
    entity_id,
    previous_data,
    next_data,
    context
  ) values (
    auth.uid(),
    case when auth.uid() is null then 'service_role' else 'auth_user' end,
    'APPLICATION_STATUS_CHANGED',
    'applications',
    new.id,
    jsonb_build_object('status', old.status, 'interview_at', old.interview_at),
    jsonb_build_object('status', new.status, 'interview_at', new.interview_at),
    jsonb_build_object('job_id', new.job_id, 'job_seeker_id', new.job_seeker_id)
  );
  return new;
end;
$$;

create or replace function public.audit_job_review_status_change()
returns trigger
language plpgsql
as $$
begin
  insert into public.integrity_audit_events (
    actor_user_id,
    actor_source,
    event_type,
    entity_table,
    entity_id,
    previous_data,
    next_data,
    context
  ) values (
    auth.uid(),
    case when auth.uid() is null then 'service_role' else 'auth_user' end,
    'JOB_REVIEW_STATUS_CHANGED',
    'jobs',
    new.id,
    jsonb_build_object('review_status', old.review_status, 'admin_feedback', old.admin_feedback),
    jsonb_build_object('review_status', new.review_status, 'admin_feedback', new.admin_feedback),
    jsonb_build_object('recruiter_id', new.recruiter_id, 'title', new.title)
  );
  return new;
end;
$$;

drop trigger if exists trg_profiles_audit_recruiter_approval on public.profiles;
create trigger trg_profiles_audit_recruiter_approval
after update of recruiter_approval_status on public.profiles
for each row
when (old.recruiter_approval_status is distinct from new.recruiter_approval_status)
execute function public.audit_recruiter_approval_change();

drop trigger if exists trg_applications_audit_status on public.applications;
create trigger trg_applications_audit_status
after update of status, interview_at on public.applications
for each row
when (old.status is distinct from new.status or old.interview_at is distinct from new.interview_at)
execute function public.audit_application_status_change();

drop trigger if exists trg_jobs_audit_review_status on public.jobs;
create trigger trg_jobs_audit_review_status
after update of review_status on public.jobs
for each row
when (old.review_status is distinct from new.review_status)
execute function public.audit_job_review_status_change();

-- Controlled admin approval workflow entrypoint.
create or replace function public.admin_set_recruiter_approval(
  p_recruiter_user_id uuid,
  p_next_status text,
  p_reason text default null
)
returns table (user_id uuid, recruiter_approval_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin_email() then
    raise exception 'Admin access required';
  end if;

  if p_next_status not in ('PENDING', 'APPROVED', 'REJECTED') then
    raise exception 'Invalid recruiter status';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_recruiter_user_id
    and role = 'RECRUITER'
  for update;

  if not found then
    raise exception 'Recruiter profile not found';
  end if;

  if not public.is_valid_recruiter_approval_transition(v_profile.recruiter_approval_status, p_next_status) then
    raise exception 'Invalid recruiter approval transition: % -> %', v_profile.recruiter_approval_status, p_next_status;
  end if;

  update public.profiles
  set recruiter_approval_status = p_next_status,
      updated_at = now()
  where id = p_recruiter_user_id;

  insert into public.notifications(user_id, type, message, metadata)
  values (
    p_recruiter_user_id,
    'RECRUITER_APPROVAL',
    case p_next_status
      when 'APPROVED' then 'Your recruiter account is approved. You can now post jobs and manage interviews.'
      when 'REJECTED' then 'Your recruiter account was rejected. Contact support for details.'
      else 'Your recruiter account is currently under review.'
    end,
    jsonb_build_object('status', p_next_status, 'reason', coalesce(p_reason, ''), 'actor', auth.uid())
  );

  insert into public.integrity_audit_events (
    actor_user_id,
    actor_source,
    event_type,
    entity_table,
    entity_id,
    previous_data,
    next_data,
    context
  )
  values (
    auth.uid(),
    'rpc',
    'ADMIN_SET_RECRUITER_APPROVAL',
    'profiles',
    p_recruiter_user_id,
    jsonb_build_object('recruiter_approval_status', v_profile.recruiter_approval_status),
    jsonb_build_object('recruiter_approval_status', p_next_status),
    jsonb_build_object('reason', coalesce(p_reason, ''))
  );

  return query
  select p.id, p.recruiter_approval_status
  from public.profiles p
  where p.id = p_recruiter_user_id;
end;
$$;

revoke all on function public.admin_set_recruiter_approval(uuid, text, text) from public;
grant execute on function public.admin_set_recruiter_approval(uuid, text, text) to authenticated;

-- Controlled recruiter application-status workflow.
create or replace function public.recruiter_update_application_status(
  p_application_id uuid,
  p_recruiter_user_id uuid,
  p_next_status text,
  p_interview_at timestamptz default null
)
returns table (application_id uuid, status text, interview_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_profile public.profiles%rowtype;
begin
  if p_next_status not in ('APPLIED', 'SHORTLISTED', 'REJECTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'HIRED') then
    raise exception 'Invalid application status';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_recruiter_user_id
    and role = 'RECRUITER'
    and recruiter_approval_status = 'APPROVED';

  if not found then
    raise exception 'Approved recruiter profile not found';
  end if;

  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  select * into v_job
  from public.jobs
  where id = v_app.job_id
    and recruiter_id = p_recruiter_user_id;

  if not found then
    raise exception 'Recruiter does not own this application/job';
  end if;

  if not public.is_valid_application_status_transition(v_app.status, p_next_status) then
    raise exception 'Invalid application transition: % -> %', v_app.status, p_next_status;
  end if;

  update public.applications
  set status = p_next_status,
      interview_at = case when p_next_status = 'INTERVIEW_SCHEDULED' then p_interview_at else null end,
      updated_at = now()
  where id = p_application_id;

  insert into public.notifications(user_id, type, message, metadata)
  values (
    v_app.job_seeker_id,
    'STATUS',
    format('Your application status for %s is now %s.', v_job.title, p_next_status),
    jsonb_build_object('applicationId', p_application_id, 'status', p_next_status, 'jobId', v_job.id)
  );

  insert into public.integrity_audit_events (
    actor_user_id,
    actor_source,
    event_type,
    entity_table,
    entity_id,
    previous_data,
    next_data,
    context
  )
  values (
    p_recruiter_user_id,
    'rpc',
    'RECRUITER_UPDATE_APPLICATION_STATUS',
    'applications',
    p_application_id,
    jsonb_build_object('status', v_app.status, 'interview_at', v_app.interview_at),
    jsonb_build_object('status', p_next_status, 'interview_at', case when p_next_status = 'INTERVIEW_SCHEDULED' then p_interview_at else null end),
    jsonb_build_object('job_id', v_app.job_id, 'job_seeker_id', v_app.job_seeker_id)
  );

  return query
  select a.id, a.status, a.interview_at
  from public.applications a
  where a.id = p_application_id;
end;
$$;

revoke all on function public.recruiter_update_application_status(uuid, uuid, text, timestamptz) from public;
grant execute on function public.recruiter_update_application_status(uuid, uuid, text, timestamptz) to authenticated;

grant execute on function public.recruiter_update_application_status(uuid, uuid, text, timestamptz) to service_role;

commit;
