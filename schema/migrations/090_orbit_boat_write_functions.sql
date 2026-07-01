-- Migration 090: ORBIT Small Boat Management — write functions + computed
-- boat status (FRS: status is always calculated, never manually set) +
-- a minimal notification log for the defect -> job -> notify manager
-- chain.
--
-- Every function derives identity from auth.uid() internally -- never
-- from a client-supplied p_reported_by/p_submitted_by/p_performed_by
-- parameter. The vendor spec's draft took these as arguments, which is
-- the same client-supplied-identity vulnerability found and fixed in
-- Port Calls (migrations 066-067) earlier this session. anon is
-- explicitly revoked below since Supabase auto-grants it independently
-- of `public` on every new function.

create table if not exists public.orbit_boat_notifications (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid references public.orbit_boats(id),
  job_id uuid references public.orbit_boat_maintenance_jobs(id),
  notification_type text not null check (notification_type in (
    'job_assigned', 'defect_reported', 'service_due', 'document_expiry'
  )),
  recipient_user_id uuid references public.user_profiles(user_id),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.orbit_boat_notifications enable row level security;
create policy orbit_boat_notifications_select on public.orbit_boat_notifications
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));

-- 1. Computed boat status resolver — FRS example triggers: open critical
--    defect, expired registration, major service overdue, failed safety
--    inspection (approximated here via the most recent submitted
--    checklist's ready_for_use = 'no').
create or replace function public.get_orbit_boat_status(p_boat_id uuid)
returns text
language sql
security invoker
stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.orbit_boat_defects d
      left join public.orbit_boat_maintenance_jobs j on j.id = d.job_id
      where d.boat_id = p_boat_id and d.urgency = 'critical'
        and (j.status is null or j.status not in ('completed', 'approved', 'cancelled'))
    ) then 'red'
    when exists (
      select 1 from public.orbit_boats b
      where b.id = p_boat_id and b.registration_expiry is not null and b.registration_expiry < current_date
    ) then 'red'
    when exists (
      select 1 from public.orbit_boat_daily_checklists dc
      where dc.boat_id = p_boat_id and dc.status = 'submitted' and dc.ready_for_use = 'no'
        and dc.checklist_date = (
          select max(checklist_date) from public.orbit_boat_daily_checklists where boat_id = p_boat_id and status = 'submitted'
        )
    ) then 'red'
    when exists (
      select 1 from public.orbit_boats b
      where b.id = p_boat_id
        and b.major_service_due_hours is not null
        and b.engine_hours >= b.major_service_due_hours
    ) then 'amber'
    when exists (
      select 1 from public.orbit_boat_defects d
      left join public.orbit_boat_maintenance_jobs j on j.id = d.job_id
      where d.boat_id = p_boat_id and d.urgency in ('high', 'normal')
        and (j.status is null or j.status not in ('completed', 'approved', 'cancelled'))
    ) then 'amber'
    else 'green'
  end;
$$;

revoke all on function public.get_orbit_boat_status(uuid) from public, anon;
grant execute on function public.get_orbit_boat_status(uuid) to authenticated;

-- 2. Boat home-screen resolver — sole source for the boat status screen,
--    same "query the view, not the raw tables" rule as every other module.
create or replace view public.v_orbit_boat_home
with (security_invoker = true) as
select
  b.id as boat_id,
  b.name,
  b.boat_type,
  b.engine_hours,
  b.major_service_due_hours,
  greatest(coalesce(b.major_service_due_hours, 0) - b.engine_hours, 0) as hours_to_next_service,
  (select count(*) from public.orbit_boat_maintenance_jobs mj where mj.boat_id = b.id and mj.status not in ('completed', 'approved', 'cancelled')) as open_jobs,
  (select count(*) from public.orbit_boat_defects d left join public.orbit_boat_maintenance_jobs j on j.id = d.job_id
     where d.boat_id = b.id and (j.status is null or j.status not in ('completed', 'approved', 'cancelled'))) as outstanding_defects,
  (select dc.checklist_date from public.orbit_boat_daily_checklists dc where dc.boat_id = b.id and dc.status = 'submitted'
     order by dc.checklist_date desc limit 1) as last_checklist_date,
  public.get_orbit_boat_status(b.id) as status
from public.orbit_boats b
where b.is_active;

comment on view public.v_orbit_boat_home is
  'Sole source for the boat status home screen. Do not query orbit_boats/
   orbit_boat_maintenance_jobs/orbit_boat_defects directly from that UI surface.';

-- 3. Update boat profile / log engine hours (separate, low-frequency edits)
create or replace function public.update_orbit_boat_profile(p_boat_id uuid, p_updates jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_module_permission(auth.uid(), 'orbit', 'edit') then
    raise exception 'Not authorized to edit boat profiles';
  end if;

  update public.orbit_boats set
    name = coalesce(p_updates->>'name', name),
    current_location = coalesce(p_updates->>'current_location', current_location),
    berth = coalesce(p_updates->>'berth', berth),
    storage_location = coalesce(p_updates->>'storage_location', storage_location),
    assigned_department = coalesce(p_updates->>'assigned_department', assigned_department),
    registration_expiry = coalesce((p_updates->>'registration_expiry')::date, registration_expiry)
  where id = p_boat_id;
end; $$;

create or replace function public.log_orbit_boat_engine_hours(p_boat_id uuid, p_current_hours numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.orbit_boats set engine_hours = p_current_hours where id = p_boat_id;
end; $$;

-- 4. Daily checklist: save draft, submit (locks via the write-once trigger)
create or replace function public.save_orbit_boat_daily_checklist(
  p_boat_id uuid, p_checklist_date date, p_responses jsonb, p_comments text, p_photo_path text, p_ready_for_use text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_checklist_id uuid;
  v_item jsonb;
  v_item_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.orbit_boat_daily_checklists (boat_id, checklist_date, comments, photo_path, ready_for_use)
  values (p_boat_id, coalesce(p_checklist_date, current_date), p_comments, p_photo_path, p_ready_for_use)
  on conflict (boat_id, checklist_date) do update set
    comments = excluded.comments, photo_path = excluded.photo_path, ready_for_use = excluded.ready_for_use
  returning id into v_checklist_id;

  delete from public.orbit_boat_checklist_responses where checklist_id = v_checklist_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb))
  loop
    select id into v_item_id from public.orbit_boat_checklist_items where code = v_item->>'code';
    if v_item_id is not null then
      insert into public.orbit_boat_checklist_responses (checklist_id, item_id, passed, notes)
      values (v_checklist_id, v_item_id, coalesce((v_item->>'passed')::boolean, true), v_item->>'notes');
    end if;
  end loop;

  return v_checklist_id;
end; $$;

create or replace function public.submit_orbit_boat_daily_checklist(p_checklist_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.orbit_boat_daily_checklists
  set status = 'submitted', submitted_by = auth.uid(), submitted_at = now()
  where id = p_checklist_id;
end; $$;

-- 5. Defect report -> maintenance job, in one transaction, plus a
--    manager notification — the FRS automation chain end to end.
create or replace function public.report_orbit_boat_defect(
  p_boat_id uuid,
  p_category text,
  p_description text,
  p_urgency text,
  p_can_operate text,
  p_source_checklist_id uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_reported_by uuid := auth.uid();
  v_defect_id uuid;
  v_job_id uuid;
  v_priority text;
  v_manager_id uuid;
begin
  if v_reported_by is null then
    raise exception 'Authentication required';
  end if;

  v_priority := case p_urgency
    when 'critical' then 'urgent'
    when 'high' then 'high'
    when 'low' then 'low'
    else 'normal'
  end;

  insert into public.orbit_boat_defects (boat_id, category, description, urgency, can_operate, source_checklist_id, reported_by)
  values (p_boat_id, p_category, p_description, p_urgency, p_can_operate, p_source_checklist_id, v_reported_by)
  returning id into v_defect_id;

  insert into public.orbit_boat_maintenance_jobs (boat_id, title, category, priority, source, source_defect_id)
  values (p_boat_id, 'Defect: ' || p_description, p_category, v_priority, 'defect', v_defect_id)
  returning id into v_job_id;

  update public.orbit_boat_defects set job_id = v_job_id where id = v_defect_id;

  select assigned_manager into v_manager_id from public.orbit_boats where id = p_boat_id;

  insert into public.orbit_boat_notifications (boat_id, job_id, notification_type, recipient_user_id, payload)
  values (p_boat_id, v_job_id, 'defect_reported', v_manager_id, jsonb_build_object(
    'defect_id', v_defect_id, 'description', p_description, 'urgency', p_urgency
  ));

  return v_defect_id;
end; $$;

-- 6. Maintenance job status advance + photo attach
create or replace function public.advance_orbit_boat_maintenance_job(
  p_job_id uuid, p_new_status text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_module_permission(auth.uid(), 'orbit', 'edit') then
    raise exception 'Not authorized to update maintenance jobs';
  end if;

  if p_new_status not in ('new', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'approved', 'cancelled') then
    raise exception 'Invalid job status: %', p_new_status;
  end if;

  update public.orbit_boat_maintenance_jobs
  set status = p_new_status,
      completed_at = case when p_new_status = 'completed' then now() else completed_at end
  where id = p_job_id;
end; $$;

create or replace function public.add_orbit_boat_job_photo(
  p_job_id uuid, p_photo_type text, p_file_path text, p_gps_lat numeric, p_gps_lng numeric
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.orbit_boat_maintenance_job_photos (job_id, photo_type, file_path, gps_lat, gps_lng)
  values (p_job_id, p_photo_type, p_file_path, p_gps_lat, p_gps_lng)
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.update_orbit_boat_profile(uuid, jsonb) from public, anon;
revoke all on function public.log_orbit_boat_engine_hours(uuid, numeric) from public, anon;
revoke all on function public.save_orbit_boat_daily_checklist(uuid, date, jsonb, text, text, text) from public, anon;
revoke all on function public.submit_orbit_boat_daily_checklist(uuid) from public, anon;
revoke all on function public.report_orbit_boat_defect(uuid, text, text, text, text, uuid) from public, anon;
revoke all on function public.advance_orbit_boat_maintenance_job(uuid, text) from public, anon;
revoke all on function public.add_orbit_boat_job_photo(uuid, text, text, numeric, numeric) from public, anon;

grant execute on function public.update_orbit_boat_profile(uuid, jsonb) to authenticated;
grant execute on function public.log_orbit_boat_engine_hours(uuid, numeric) to authenticated;
grant execute on function public.save_orbit_boat_daily_checklist(uuid, date, jsonb, text, text, text) to authenticated;
grant execute on function public.submit_orbit_boat_daily_checklist(uuid) to authenticated;
grant execute on function public.report_orbit_boat_defect(uuid, text, text, text, text, uuid) to authenticated;
grant execute on function public.advance_orbit_boat_maintenance_job(uuid, text) to authenticated;
grant execute on function public.add_orbit_boat_job_photo(uuid, text, text, numeric, numeric) to authenticated;
