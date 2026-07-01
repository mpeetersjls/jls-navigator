-- Migration 061: Audit log, resolver views, and SECURITY DEFINER write
-- functions. Enforces the same read/write separation rule used in the
-- Visa module: nothing mutates port_calls / workflow steps / documents
-- directly from the client.

-- 1. Audit log (write-once snapshot, same pattern as visa_report_log)
create table if not exists public.port_call_audit_log (
  id uuid primary key default gen_random_uuid(),
  port_call_id uuid not null references public.port_calls(id) on delete cascade,
  action text not null,             -- e.g. 'workflow_step_advanced', 'status_changed'
  snapshot_data jsonb not null,     -- write-once; never updated after insert
  performed_by uuid references public.user_profiles(user_id),
  performed_at timestamptz not null default now()
);

alter table public.port_call_audit_log enable row level security;
create policy port_call_audit_log_select on public.port_call_audit_log
  for select using (auth.role() = 'authenticated');
-- No update/delete policy at all — write-once by omission, enforced at
-- the database level, not just by convention.

-- 2. Resolver view: dashboard "Arrivals" panel scoped to this slice (FRS §4)
-- Vessel identity: public.yachts(id), display column vessel_name (this
-- repo has no public.vessels table — confirmed against live schema).
create or replace view public.v_inward_clearance_active as
select
  pc.id as port_call_id,
  y.vessel_name as vessel_name,
  pc.eta,
  pcs.label as status_label,
  pc.assigned_office,
  pc.assigned_agent_id,
  count(*) filter (where wfs.status = 'pending') as steps_outstanding,
  count(*) filter (where wfs.status = 'completed') as steps_completed,
  count(*) as steps_total
from public.port_calls pc
join public.yachts y on y.id = pc.vessel_id
join public.port_call_status pcs on pcs.id = pc.status_id
left join public.port_call_workflow_steps wfs
  on wfs.port_call_id = pc.id
  and wfs.workflow_definition_id = (
    select id from public.workflow_definitions where code = 'inward_clearance'
  )
where pcs.code not in ('completed')
group by pc.id, y.vessel_name, pc.eta, pcs.label, pc.assigned_office, pc.assigned_agent_id;

comment on view public.v_inward_clearance_active is
  'Sole source for the Agency dashboard Arrivals panel in this slice.
   Do not query port_calls/port_call_workflow_steps directly from the
   dashboard — same rule as vessel_active_crew for the Visa module.';

-- 3. Resolver function: compliance traffic light (FRS §15), read-only
create or replace function public.get_port_call_compliance(p_port_call_id uuid)
returns text
language sql
security invoker
stable
as $$
  select case
    when exists (
      select 1 from public.port_call_documents d
      where d.port_call_id = p_port_call_id
        and d.is_mandatory
        and d.validation_status in ('invalid', 'expired')
    ) then 'critical'
    when exists (
      select 1 from public.port_call_documents d
      where d.port_call_id = p_port_call_id
        and d.is_mandatory
        and d.validation_status = 'pending'
    ) then 'action_required'
    else 'compliant'
  end;
$$;

-- 4. Write function: create a Port Call + generate its document
--    checklist from country_requirement_config in one transaction.
create or replace function public.create_port_call(
  p_vessel_id uuid,
  p_destination_country_id uuid,
  p_eta timestamptz,
  p_etd timestamptz,
  p_assigned_office text,
  p_assigned_agent_id uuid,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_port_call_id uuid;
  v_initial_status_id uuid;
begin
  select id into v_initial_status_id
  from public.port_call_status where code = 'enquiry';

  insert into public.port_calls (
    vessel_id, destination_country_id, eta, etd,
    assigned_office, assigned_agent_id, status_id, created_by
  ) values (
    p_vessel_id, p_destination_country_id, p_eta, p_etd,
    p_assigned_office, p_assigned_agent_id, v_initial_status_id, p_created_by
  ) returning id into v_port_call_id;

  insert into public.port_call_documents (
    port_call_id, requirement_config_id, code, label, is_mandatory
  )
  select v_port_call_id, c.id, c.code, c.label, c.is_mandatory
  from public.country_requirement_config c
  where c.country_id = p_destination_country_id
    and c.requirement_type = 'pre_arrival_document'
    and c.is_active;

  insert into public.port_call_audit_log (port_call_id, action, snapshot_data, performed_by)
  values (v_port_call_id, 'port_call_created', jsonb_build_object(
    'vessel_id', p_vessel_id, 'destination_country_id', p_destination_country_id
  ), p_created_by);

  return v_port_call_id;
end;
$$;

-- 5. Write function: start a workflow on a Port Call (generates step instances)
create or replace function public.start_port_call_workflow(
  p_port_call_id uuid,
  p_workflow_code text,
  p_performed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow_id uuid;
begin
  select id into v_workflow_id
  from public.workflow_definitions where code = p_workflow_code;

  if v_workflow_id is null then
    raise exception 'Unknown workflow code: %', p_workflow_code;
  end if;

  insert into public.port_call_workflow_steps (
    port_call_id, workflow_definition_id, step_definition_id
  )
  select p_port_call_id, v_workflow_id, sd.id
  from public.workflow_step_definitions sd
  where sd.workflow_definition_id = v_workflow_id
    and sd.is_active
  on conflict (port_call_id, step_definition_id) do nothing;

  insert into public.port_call_audit_log (port_call_id, action, snapshot_data, performed_by)
  values (p_port_call_id, 'workflow_started', jsonb_build_object('workflow_code', p_workflow_code), p_performed_by);
end;
$$;

-- 6. Write function: advance a single workflow step
--    "Generate" vs "Submit" stay separate actions — this function only
--    changes workflow state; document generation is a separate function
--    (left for the document-template ticket, not duplicated here).
create or replace function public.advance_workflow_step(
  p_port_call_id uuid,
  p_step_code text,
  p_new_status text,
  p_notes text,
  p_performed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step_id uuid;
begin
  if p_new_status not in ('in_progress', 'completed', 'rejected', 'skipped') then
    raise exception 'Invalid step status: %', p_new_status;
  end if;

  select wfs.id into v_step_id
  from public.port_call_workflow_steps wfs
  join public.workflow_step_definitions sd on sd.id = wfs.step_definition_id
  where wfs.port_call_id = p_port_call_id
    and sd.code = p_step_code;

  if v_step_id is null then
    raise exception 'Step % not found for port_call %', p_step_code, p_port_call_id;
  end if;

  update public.port_call_workflow_steps
  set status = p_new_status,
      notes = p_notes,
      completed_by = case when p_new_status = 'completed' then p_performed_by else completed_by end,
      completed_at = case when p_new_status = 'completed' then now() else completed_at end
  where id = v_step_id;

  insert into public.port_call_audit_log (port_call_id, action, snapshot_data, performed_by)
  values (p_port_call_id, 'workflow_step_advanced', jsonb_build_object(
    'step_code', p_step_code, 'new_status', p_new_status, 'notes', p_notes
  ), p_performed_by);

  -- Auto-update Port Call status to 'inward_clearance_completed' once
  -- the final step ('port_entry') is completed.
  if p_step_code = 'port_entry' and p_new_status = 'completed' then
    update public.port_calls
    set status_id = (select id from public.port_call_status where code = 'inward_clearance_completed')
    where id = p_port_call_id;
  end if;
end;
$$;

-- 7. Write function: update document validation/approval status
--    (kept separate from advance_workflow_step — documents and workflow
--    steps are distinct concerns even though they're related).
create or replace function public.update_port_call_document_status(
  p_document_id uuid,
  p_validation_status text,
  p_approval_status text,
  p_performed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_port_call_id uuid;
begin
  select port_call_id into v_port_call_id
  from public.port_call_documents where id = p_document_id;

  update public.port_call_documents
  set validation_status = coalesce(p_validation_status, validation_status),
      approval_status = coalesce(p_approval_status, approval_status)
  where id = p_document_id;

  insert into public.port_call_audit_log (port_call_id, action, snapshot_data, performed_by)
  values (v_port_call_id, 'document_status_updated', jsonb_build_object(
    'document_id', p_document_id,
    'validation_status', p_validation_status,
    'approval_status', p_approval_status
  ), p_performed_by);
end;
$$;

grant execute on function public.create_port_call to authenticated;
grant execute on function public.start_port_call_workflow to authenticated;
grant execute on function public.advance_workflow_step to authenticated;
grant execute on function public.update_port_call_document_status to authenticated;
grant execute on function public.get_port_call_compliance to authenticated;
