-- Migration 086: ORBIT Small Boat Management — Boat Profile
-- Reconciled against a vendor go-live spec that assumed a bare `boats`
-- table and an FK to a nonexistent `public.staff`. Renamed to the
-- `orbit_boat_*` family to avoid confusion with the existing yacht-scoped
-- orbit_defects/orbit_maintenance (yacht_id-keyed, no automation) — this
-- module tracks a separate population (tenders/RIBs/workboats/chase
-- boats, 5-30m) with its own automated status + defect->job chain.
--
-- public.small_boats already exists but is a DMA/FTA REGISTRATION
-- paperwork tracker (docs checklist, quotation, inspection dates) with
-- no operational fields (engine hours, maintenance, checklists) — kept
-- fully separate per the spec's own scoping call, but correlated via a
-- nullable FK so a boat's registration record and operational profile
-- can be linked when both exist.

create table if not exists public.orbit_boats (
  id uuid primary key default gen_random_uuid(),

  small_boat_id uuid references public.small_boats(id), -- optional correlation to the registration record

  name text not null,
  registration text,
  boat_type text check (boat_type in (
    'tender', 'chase_boat', 'rib', 'crew_boat', 'work_boat',
    'patrol_vessel', 'day_boat', 'sailing_yacht', 'owner_tender'
  )),
  length_m numeric(5,2),
  manufacturer text,
  model text,
  year int,
  hull_number text,

  current_location text,
  berth text,
  storage_location text,

  fuel_type text check (fuel_type in ('petrol', 'diesel', 'electric', 'hybrid')),
  engine text,
  engine_hours numeric(8,1) not null default 0,
  has_trailer boolean not null default false,

  assigned_department text,
  assigned_manager uuid references public.user_profiles(user_id),

  registration_expiry date,
  major_service_due_hours numeric(8,1),
  major_service_interval_hours numeric(8,1) default 250,

  qr_code text, -- reserved for QR generation; not wired to a scanner in this slice

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orbit_boats is
  'ORBIT Small Boat Management boat profile. Separate population from
   public.yachts (superyacht fleet); optionally correlated to
   public.small_boats (DMA/FTA registration paperwork) via small_boat_id.';

drop trigger if exists trg_orbit_boats_updated_at on public.orbit_boats;
create trigger trg_orbit_boats_updated_at
  before update on public.orbit_boats
  for each row execute function public.set_updated_at();

create index if not exists idx_orbit_boats_active on public.orbit_boats (is_active);
create index if not exists idx_orbit_boats_small_boat on public.orbit_boats (small_boat_id);

alter table public.orbit_boats enable row level security;
create policy orbit_boats_select on public.orbit_boats
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));

-- No direct write policy — mutation via update_orbit_boat_profile /
-- log_orbit_boat_engine_hours in migration 090.
