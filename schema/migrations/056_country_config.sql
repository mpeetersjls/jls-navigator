-- Migration 056: Country config layer (Agency Module — Vertical Slice 1)
-- Built now per scoping decision so Oman/other countries slot in via
-- config rows, not schema changes. UAE is the only country seeded with
-- requirement data in this slice.
--
-- FK targets confirmed against the live schema (ticket #196):
--   staff/agent identity -> public.user_profiles(user_id), NOT public.staff
--     (which does not exist). user_profiles is the access-control identity
--     table documented in POLARIS_ACCESS_CONTROL.md and already live with
--     role_id -> public.roles(role_id).
--   vessel identity -> public.yachts(id), NOT public.vessels (which does
--     not exist in this repo; vessels are called "yachts" throughout).

-- Shared admin check, reused by every write-admin policy in migrations
-- 056/057/060 below. Mirrors src/lib/auth/claims.ts deriveClaims(): primary
-- path is user_profiles.role_id -> roles.name in GLOBAL_ADMIN_ROLES, with
-- the legacy user_roles/app_role 'admin' fallback kept for continuity
-- while user_profiles is still being populated during rollout.
create or replace function public.is_polaris_global_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_profiles up
      join public.roles r on r.role_id = up.role_id
      where up.user_id = p_user_id
        and r.name in ('global_admin', 'platform_owner', 'developer')
    )
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_user_id and ur.role = 'admin'
    );
$$;

grant execute on function public.is_polaris_global_admin to authenticated;

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_code text not null unique,        -- 'AE', 'OM', etc.
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.countries is
  'Country master list. New countries are activated by inserting a row
   here plus rows in country_requirement_config — never a migration.';

-- A generic config table for "what does this country require" — used
-- for pre-arrival document checklists (FRS §8) and, in later slices,
-- the Service Catalogue (FRS §13) and Government Services (FRS §9).
create table if not exists public.country_requirement_config (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  requirement_type text not null check (requirement_type in (
    'pre_arrival_document', 'government_service', 'agency_service'
  )),
  code text not null,                   -- e.g. 'last_port_clearance', 'navigation_licence'
  label text not null,
  description text,
  is_mandatory boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, requirement_type, code)
);

comment on table public.country_requirement_config is
  'Per-country requirement definitions. requirement_type=pre_arrival_document
   rows drive the FRS §8 checklist for this slice. government_service and
   agency_service rows are reserved for future slices (FRS §9, §13).';

create index if not exists idx_country_requirement_config_country
  on public.country_requirement_config (country_id, requirement_type, is_active);

-- Seed: UAE
insert into public.countries (iso_code, name)
values ('AE', 'United Arab Emirates')
on conflict (iso_code) do nothing;

-- Seed: UAE pre-arrival document checklist (FRS §8), excluding crew/passport/visa
-- items which remain entirely owned by the Immigration Module.
with uae as (select id from public.countries where iso_code = 'AE')
insert into public.country_requirement_config
  (country_id, requirement_type, code, label, is_mandatory, sort_order)
select uae.id, 'pre_arrival_document', v.code, v.label, true, v.sort_order
from uae, (values
  ('last_port_departure_clearance', 'Last Port Departure Clearance', 10),
  ('declaration_last_10_ports', 'Declaration of Last 10 Ports', 20),
  ('registry_certificate', 'Registry Certificate', 30),
  ('min_safe_manning_certificate', 'Minimum Safe Manning Certificate', 40),
  ('classification_certificate', 'Classification Certificate', 50),
  ('isps_dos', 'ISPS/DOS', 60),
  ('issc', 'ISSC', 70),
  ('maritime_declaration_of_health', 'Maritime Declaration of Health', 80),
  ('nil_firearms_declaration', 'Master''s NIL Firearms Declaration', 90),
  ('pi_insurance', 'Protection & Indemnity Insurance', 100),
  ('hull_machinery_insurance', 'Hull & Machinery Insurance', 110),
  ('captains_coc', 'Captain''s Certificate of Competency', 120),
  ('ship_stores_declaration', 'Ship Stores Declaration', 130),
  ('cargo_manifest', 'Cargo Manifest', 140),
  ('sanitation_certificate', 'Sanitation Certificate', 150),
  ('air_draft', 'Air Draft', 160)
) as v(code, label, sort_order)
on conflict (country_id, requirement_type, code) do nothing;

alter table public.countries enable row level security;
alter table public.country_requirement_config enable row level security;

-- Read-only reference data: any authenticated Polaris user may read.
create policy countries_select on public.countries
  for select using (auth.role() = 'authenticated');
create policy country_requirement_config_select on public.country_requirement_config
  for select using (auth.role() = 'authenticated');

-- Writes restricted to global admin (same role pattern as Immigration module).
create policy countries_write_admin on public.countries
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
create policy country_requirement_config_write_admin on public.country_requirement_config
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
