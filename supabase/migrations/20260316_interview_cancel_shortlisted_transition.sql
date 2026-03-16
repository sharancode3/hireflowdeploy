begin;

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

  -- Allow interview cancellation back to shortlisted.
  if old_status = 'INTERVIEW_SCHEDULED' and next_status in ('SHORTLISTED', 'OFFERED', 'REJECTED') then
    return true;
  end if;

  if old_status = 'OFFERED' and next_status in ('HIRED', 'REJECTED') then
    return true;
  end if;

  return false;
end;
$$;

commit;
