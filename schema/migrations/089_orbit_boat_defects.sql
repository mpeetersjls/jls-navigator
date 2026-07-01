-- Migration 089: ORBIT Small Boat Management — Defect Reporting
-- Always creates a maintenance job in the same transaction (see
-- report_orbit_boat_defect in migration 090) — never a separate manual
-- "convert to job" step, per the FRS's locked decision.

create table if not exists public.orbit_boat_defects (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.orbit_boats(id) on delete cascade,

  category text,
  description text not null,
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'critical')),
  can_operate text not null check (can_operate in ('yes', 'limited', 'no')),

  source_checklist_id uuid references public.orbit_boat_daily_checklists(id), -- set when raised from a failed checklist item
  job_id uuid references public.orbit_boat_maintenance_jobs(id),

  reported_by uuid references public.user_profiles(user_id),
  reported_at timestamptz not null default now()
);

create table if not exists public.orbit_boat_defect_photos (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid not null references public.orbit_boat_defects(id) on delete cascade,
  file_path text not null,
  taken_at timestamptz not null default now()
);

alter table public.orbit_boat_maintenance_jobs
  add constraint fk_orbit_boat_jobs_source_defect
  foreign key (source_defect_id) references public.orbit_boat_defects(id);

create index if not exists idx_orbit_boat_defects_boat on public.orbit_boat_defects (boat_id);

alter table public.orbit_boat_defects enable row level security;
alter table public.orbit_boat_defect_photos enable row level security;

create policy orbit_boat_defects_select on public.orbit_boat_defects
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));
create policy orbit_boat_defect_photos_select on public.orbit_boat_defect_photos
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));

-- No direct write policies — mutation via report_orbit_boat_defect in
-- migration 090, which is the only path that creates a defect, and does
-- so together with its maintenance job in one transaction.
