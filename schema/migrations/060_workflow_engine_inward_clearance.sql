-- Migration 060: Workflow engine (generic) + Inward Clearance steps (FRS §10)
-- Built generic on purpose: Outward Clearance, Funds in Place, etc. reuse
-- the same workflow_definitions / workflow_step_definitions tables in
-- later slices — only seed data changes, not schema.

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,         -- 'inward_clearance', 'outward_clearance', ...
  label text not null,
  is_active boolean not null default true
);

create table if not exists public.workflow_step_definitions (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  code text not null,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (workflow_definition_id, code)
);

create table if not exists public.port_call_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  port_call_id uuid not null references public.port_calls(id) on delete cascade,
  workflow_definition_id uuid not null references public.workflow_definitions(id),
  step_definition_id uuid not null references public.workflow_step_definitions(id),
  status text not null default 'pending' check (status in (
    'pending', 'in_progress', 'completed', 'rejected', 'skipped'
  )),
  notes text,
  completed_by uuid references public.user_profiles(user_id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (port_call_id, step_definition_id)
);

comment on table public.port_call_workflow_steps is
  'Per-Port-Call instance of a workflow''s steps. Generated when a
   workflow is started on a Port Call (see start_port_call_workflow in
   migration 061). Status only changes through advance_workflow_step,
   never a direct client update.';

create index if not exists idx_port_call_workflow_steps_port_call
  on public.port_call_workflow_steps (port_call_id, workflow_definition_id);

-- Seed: Inward Clearance workflow (FRS §10)
insert into public.workflow_definitions (code, label)
values ('inward_clearance', 'Inward Clearance')
on conflict (code) do nothing;

with wf as (select id from public.workflow_definitions where code = 'inward_clearance')
insert into public.workflow_step_definitions (workflow_definition_id, code, label, sort_order)
select wf.id, v.code, v.label, v.sort_order
from wf, (values
  ('arrival_notice', 'Arrival Notice', 10),
  ('documentation_verified', 'Documentation Verified', 20),
  ('government_submission', 'Government Submission', 30),
  ('authority_review', 'Authority Review', 40),
  ('approval_received', 'Approval Received', 50),
  ('arrival_clearance', 'Arrival Clearance', 60),
  ('port_entry', 'Port Entry', 70)
) as v(code, label, sort_order)
on conflict (workflow_definition_id, code) do nothing;

alter table public.workflow_definitions enable row level security;
alter table public.workflow_step_definitions enable row level security;
alter table public.port_call_workflow_steps enable row level security;

create policy workflow_definitions_select on public.workflow_definitions
  for select using (auth.role() = 'authenticated');
create policy workflow_step_definitions_select on public.workflow_step_definitions
  for select using (auth.role() = 'authenticated');
create policy port_call_workflow_steps_select on public.port_call_workflow_steps
  for select using (auth.role() = 'authenticated');

-- public.is_polaris_global_admin() defined in migration 056.
create policy workflow_definitions_write_admin on public.workflow_definitions
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
create policy workflow_step_definitions_write_admin on public.workflow_step_definitions
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));

-- port_call_workflow_steps: no direct write policy — SECURITY DEFINER
-- functions only (migration 061).
