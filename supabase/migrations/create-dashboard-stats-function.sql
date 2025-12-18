-- Aggregated dashboard stats function to minimize client-side queries
-- Safe for both admin and client contexts; respects role from JWT claims

create or replace function public.get_dashboard_stats(
  is_admin boolean default false
) returns table (
  total_applications bigint,
  pending_applications bigint,
  completed_applications bigint,
  rejected_applications bigint,
  total_quotations bigint,
  pending_quotations bigint,
  paid_quotations bigint,
  total_clients bigint,
  revenue numeric
)
security definer
set search_path = public
language plpgsql
as $$
declare
  claims json;
  role text;
  uid uuid;
  pending_adjust bigint := 0;
begin
  claims := coalesce(current_setting('request.jwt.claims', true), '{}')::json;
  role := coalesce(
    claims ->> 'role',
    claims #>> '{app_metadata,role}',
    claims #>> '{user_metadata,role}'
  );
  uid := nullif(claims ->> 'sub', '')::uuid;

  -- Enforce client scope unless caller is actually an admin
  if role is distinct from 'admin' then
    is_admin := false;
  end if;

  if not is_admin then
    -- Guard against unauthenticated access
    if uid is null then
      total_applications := 0;
      pending_applications := 0;
      completed_applications := 0;
      rejected_applications := 0;
      total_quotations := 0;
      pending_quotations := 0;
      paid_quotations := 0;
      total_clients := 0;
      revenue := 0;
      return next;
      return;
    end if;

    select count(*) into total_applications from public.applications where user_id = uid;
    select count(*) into pending_applications from public.applications where user_id = uid and lower(status) = 'pending';
    select count(*) into completed_applications from public.applications where user_id = uid and lower(status) = 'completed';
    select count(*) into rejected_applications from public.applications where user_id = uid and lower(status) = 'rejected';

    select count(*) into total_quotations from public.quotations where user_id = uid;
    select count(*) into pending_quotations from public.quotations where user_id = uid and lower(status) = 'pending';
    select count(*) into paid_quotations from public.quotations where user_id = uid and lower(status) = 'paid';

    select coalesce(sum(amount), 0) into revenue
    from public.application_payments
    where user_id = uid and status = 'paid';

    total_clients := 0;

    -- Add timeline-based completions not yet marked completed by status
    completed_applications := completed_applications + (
      select count(distinct ats.application_id)
      from public.application_timeline_steps ats
      join public.applications a on a.id = ats.application_id
      where a.user_id = uid
        and ats.step_key in ('nclex_exam', 'quick_results')
        and ats.status = 'completed'
        and lower(coalesce(a.status, '')) not in ('completed', 'rejected')
    );

    return next;
    return;
  end if;

  -- Admin scope
  select count(*) into total_applications from public.applications;
  select count(*) into pending_applications from public.applications where lower(status) = 'pending';
  select count(*) into completed_applications from public.applications where lower(status) = 'completed';
  select count(*) into rejected_applications from public.applications where lower(status) = 'rejected';

  select count(*) into total_quotations from public.quotations;
  select count(*) into pending_quotations from public.quotations where lower(status) = 'pending';
  select count(*) into paid_quotations from public.quotations where lower(status) = 'paid';

  select count(*) into total_clients from public.users where role = 'client';

  select coalesce(sum(amount), 0) into revenue
  from public.application_payments
  where status = 'paid';

  -- Include timeline-based completions where status is not yet updated
  completed_applications := completed_applications + (
    select count(distinct ats.application_id)
    from public.application_timeline_steps ats
    join public.applications a on a.id = ats.application_id
    where ats.step_key in ('nclex_exam', 'quick_results')
      and ats.status = 'completed'
      and lower(coalesce(a.status, '')) not in ('completed', 'rejected')
  );

  -- Remove timeline-completed apps from pending to avoid double counting
  pending_adjust := (
    select count(distinct ats.application_id)
    from public.application_timeline_steps ats
    join public.applications a on a.id = ats.application_id
    where lower(coalesce(a.status, '')) = 'pending'
      and ats.step_key in ('nclex_exam', 'quick_results')
      and ats.status = 'completed'
  );
  pending_applications := greatest(0, pending_applications - pending_adjust);
  
  return next;
end;
$$;

comment on function public.get_dashboard_stats(boolean) is
'Aggregated dashboard counts for admin/client views; minimizes client-side query fan-out.';

