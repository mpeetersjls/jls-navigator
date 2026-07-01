-- Migration 057: Configurable Port Call status table
-- Per scoping decision: NOT a Postgres enum. Statuses are data so they
-- can be edited/reordered without a migration. FRS §3 lists 9 example
-- statuses — seeded here as defaults, not hardcoded into the type system.

create table if not exists public.port_call_status (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- stable machine key, never shown to users
  label text not null,                  -- display label, editable
  sort_order int not null default 0,    -- drives workflow ordering on dashboard
  is_terminal boolean not null default false,  -- e.g. 'completed'
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.port_call_status is
  'Configurable Port Call statuses. Edit labels/order here, not via
   migration. code is the only value referenced by application logic;
   label is free to change at any time.';

insert into public.port_call_status (code, label, sort_order, is_terminal) values
  ('enquiry', 'Enquiry', 10, false),
  ('awaiting_documentation', 'Awaiting Documentation', 20, false),
  ('submission', 'Submission', 30, false),
  ('awaiting_approval', 'Awaiting Approval', 40, false),
  ('inward_clearance_completed', 'Inward Clearance Completed', 50, false),
  ('cruising_permits_issued', 'Cruising Permits Issued', 60, false),
  ('departure_processing', 'Departure Processing', 70, false),
  ('cleared_to_sail', 'Cleared to Sail', 80, false),
  ('completed', 'Completed', 90, true)
on conflict (code) do nothing;

alter table public.port_call_status enable row level security;

create policy port_call_status_select on public.port_call_status
  for select using (auth.role() = 'authenticated');

-- public.is_polaris_global_admin() defined in migration 056.
create policy port_call_status_write_admin on public.port_call_status
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
