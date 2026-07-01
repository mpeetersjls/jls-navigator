-- Migration 088: ORBIT Small Boat Management — Daily Checklist
-- Fixed item set for this slice, per the go-live doc. A submitted
-- checklist is a safety record and is locked at the database level once
-- submitted -- same caution as the BDN / Master's Declaration write-once
-- rule in ORBIT Operations (migration 083).

create table if not exists public.orbit_boat_checklist_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order int not null default 0,
  applies_to_trailer_only boolean not null default false,
  is_active boolean not null default true
);

insert into public.orbit_boat_checklist_items (code, label, sort_order, applies_to_trailer_only) values
  ('exterior_condition', 'Exterior condition', 10, false),
  ('hull_damage', 'Hull damage', 20, false),
  ('fuel', 'Fuel', 30, false),
  ('oil', 'Oil', 40, false),
  ('battery', 'Battery', 50, false),
  ('bilge', 'Bilge', 60, false),
  ('navigation_lights', 'Navigation lights', 70, false),
  ('radio', 'Radio', 80, false),
  ('safety_equipment', 'Safety equipment', 90, false),
  ('lifejackets', 'Lifejackets', 100, false),
  ('fire_extinguisher', 'Fire extinguisher', 110, false),
  ('anchor', 'Anchor', 120, false),
  ('lines', 'Lines', 130, false),
  ('trailer', 'Trailer', 140, true)
on conflict (code) do nothing;

create table if not exists public.orbit_boat_daily_checklists (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.orbit_boats(id) on delete cascade,

  checklist_date date not null default current_date,
  comments text,
  photo_path text,
  ready_for_use text check (ready_for_use in ('yes', 'limited', 'no')),

  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_by uuid references public.user_profiles(user_id),
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  unique (boat_id, checklist_date)
);

create table if not exists public.orbit_boat_checklist_responses (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.orbit_boat_daily_checklists(id) on delete cascade,
  item_id uuid not null references public.orbit_boat_checklist_items(id),
  passed boolean not null default true,
  notes text,
  unique (checklist_id, item_id)
);

create or replace function public.prevent_submitted_orbit_boat_checklist_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'submitted' and new is distinct from old then
    raise exception 'orbit_boat_daily_checklists is locked once submitted — start a new checklist instead of editing';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_submitted_orbit_boat_checklist_edit on public.orbit_boat_daily_checklists;
create trigger trg_prevent_submitted_orbit_boat_checklist_edit
  before update on public.orbit_boat_daily_checklists
  for each row execute function public.prevent_submitted_orbit_boat_checklist_edit();

create index if not exists idx_orbit_boat_daily_checklists_boat on public.orbit_boat_daily_checklists (boat_id, checklist_date desc);
create index if not exists idx_orbit_boat_checklist_responses_checklist on public.orbit_boat_checklist_responses (checklist_id);

alter table public.orbit_boat_checklist_items enable row level security;
alter table public.orbit_boat_daily_checklists enable row level security;
alter table public.orbit_boat_checklist_responses enable row level security;

create policy orbit_boat_checklist_items_select on public.orbit_boat_checklist_items
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));
create policy orbit_boat_daily_checklists_select on public.orbit_boat_daily_checklists
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));
create policy orbit_boat_checklist_responses_select on public.orbit_boat_checklist_responses
  for select using (public.has_module_permission(auth.uid(), 'orbit', 'view'));

-- No direct write policies — mutation via migration 090 functions.
