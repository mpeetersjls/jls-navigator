-- Migration 087: ORBIT Small Boat Management — Maintenance Jobs
-- Minimal FRS Task Management entity, enough to receive auto-generated
-- jobs from defects (migration 089). Distinct from the existing
-- orbit_maintenance table (yacht-scoped scheduled PM, no automation) --
-- these are boat-scoped, can originate from a defect or a failed
-- checklist item, and carry a status set matching the FRS chain.

create table if not exists public.orbit_boat_maintenance_jobs (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.orbit_boats(id) on delete cascade,

  title text not null,
  category text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in (
    'new', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'approved', 'cancelled'
  )),

  assigned_to uuid references public.user_profiles(user_id),
  due_date date,
  notes text,

  source text not null default 'manual' check (source in ('manual', 'defect', 'checklist_failure')),
  source_defect_id uuid, -- FK added in migration 089 once orbit_boat_defects exists

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

drop trigger if exists trg_orbit_boat_maintenance_jobs_updated_at on public.orbit_boat_maintenance_jobs;
create trigger trg_orbit_boat_maintenance_jobs_updated_at
  before update on public.orbit_boat_maintenance_jobs
  for each row execute function public.set_updated_at();

create index if not exists idx_orbit_boat_jobs_boat on public.orbit_boat_maintenance_jobs (boat_id);
create index if not exists idx_orbit_boat_jobs_status on public.orbit_boat_maintenance_jobs (status);

-- Photo documentation (before/during/after/defect), generic across jobs.
create table if not exists public.orbit_boat_maintenance_job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.orbit_boat_maintenance_jobs(id) on delete cascade,
  photo_type text not null check (photo_type in ('before', 'during', 'after', 'defect')),
  file_path text not null,
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  taken_at timestamptz not null default now()
);

create index if not exists idx_orbit_boat_job_photos_job on public.orbit_boat_maintenance_job_photos (job_id);

alter table public.orbit_boat_maintenance_jobs enable row level security;
alter table public.orbit_boat_maintenance_job_photos enable row level security;

create policy orbit_boat_maintenance_jobs_select on public.orbit_boat_maintenance_jobs
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));
create policy orbit_boat_maintenance_job_photos_select on public.orbit_boat_maintenance_job_photos
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));

-- No direct write policies — mutation via migration 090 functions.
