-- Migration 065: Client/Vessel entity foundation for Port Calls module
-- (renumbered from a draft "Migration 056" — that number was already used
-- by 056_country_config.sql in this repo's migration history)
--
-- Resolves the client/vessel entity gap identified in Port Calls redesign review:
--   1. yachts gets org_id, linking each vessel to a normalized organisation
--   2. organisations backfilled from existing yacht text fields (company_name / owners_name)
--   3. agency_contacts repurposed as a real person-level contact table (was disconnected, no FKs)
--   4. port_calls gets organisation_id, so a port call can reference the client independent of vessel_id
--   5. port_calls.assigned_office (free text) replaced with assigned_office_id (FK to offices)
--
-- Safe to run: yachts has 180 live rows (data preserved, only adding a column + backfilling org_id).
-- port_calls, organisations, agency_contacts, offices all have 0 rows in production today,
-- so steps 3-5 are schema-only with no data-loss risk.
--
-- FK targets verified against the live schema before applying: organisations.org_id,
-- offices.id, and yachts.company_name/owners_name/contact_person/email_address/contact_no
-- all exist exactly as referenced below. organisations.type is constrained to a fixed
-- enum (jls_internal/vessel_management/owner/family_office/supplier/training/
-- crew_placement/agency/client) — the backfill below uses 'vessel_management'/'owner',
-- not the original draft's 'management_company'/'owner_office' (caught on first apply).
--
-- NOTE: dropping agency_contacts.company breaks the existing "Agency Network" page
-- (src/routes/_app.agency.tsx), whose ResourcePage config has a `company` text field.
-- Companion app fix ships in the same commit: ResourcePage gains a generic "org" field
-- type (mirrors its existing "yacht" field type) and _app.agency.tsx swaps `company`
-- for an `org_id` organisation picker.

begin;

-- ============================================================
-- STEP 1: Add org_id to yachts (nullable FK, no data loss)
-- ============================================================
alter table public.yachts
  add column if not exists org_id uuid references public.organisations(org_id);

create index if not exists idx_yachts_org_id on public.yachts(org_id);

-- ============================================================
-- STEP 2: Backfill organisations from existing yacht text fields.
-- Priority: company_name (management company) first, fall back to
-- owners_name (owner-held entity) when company_name is blank.
-- Dedup by normalized (trimmed, lowercased) name so multiple vessels
-- under the same management company collapse into one org record.
--
-- NOTE: this is exact-match dedup on trimmed/lowercased text. If the
-- same company was typed inconsistently across vessels (e.g. "ABC
-- Yachting" vs "ABC Yachting LLC"), it will create two orgs. Worth a
-- manual scan of the results before merging duplicates by hand.
-- ============================================================

with source_names as (
  select
    y.id as yacht_id,
    coalesce(nullif(trim(y.company_name), ''), nullif(trim(y.owners_name), '')) as org_name,
    -- organisations.type has a check constraint restricting it to a fixed
    -- enum (jls_internal/vessel_management/owner/family_office/supplier/
    -- training/crew_placement/agency/client) — verified against the live
    -- schema after the first apply attempt failed on this constraint.
    case
      when nullif(trim(y.company_name), '') is not null then 'vessel_management'
      else 'owner'
    end as org_type
  from public.yachts y
  where y.org_id is null
    and coalesce(nullif(trim(y.company_name), ''), nullif(trim(y.owners_name), '')) is not null
),
distinct_orgs as (
  select
    lower(org_name) as norm_name,
    min(org_name) as display_name,   -- keep first-seen casing
    min(org_type) as org_type
  from source_names
  group by lower(org_name)
),
inserted as (
  insert into public.organisations (org_id, name, type, country_code, active)
  select
    gen_random_uuid(),
    display_name,
    org_type,
    null,   -- country_code intentionally left null; no reliable ISO source in yachts today
    true
  from distinct_orgs
  returning org_id, name
)
update public.yachts y
set org_id = i.org_id
from inserted i
where lower(coalesce(nullif(trim(y.company_name), ''), nullif(trim(y.owners_name), ''))) = lower(i.name)
  and y.org_id is null;

-- ============================================================
-- STEP 3: Repurpose agency_contacts into a normalized person-level
-- contact table, linked to organisations (and optionally a vessel),
-- instead of the disconnected free-text "company" field it had.
-- ============================================================

alter table public.agency_contacts
  add column if not exists org_id uuid references public.organisations(org_id),
  add column if not exists vessel_id uuid references public.yachts(id);

alter table public.agency_contacts
  drop column if exists company;

create index if not exists idx_agency_contacts_org_id on public.agency_contacts(org_id);
create index if not exists idx_agency_contacts_vessel_id on public.agency_contacts(vessel_id);

-- Backfill one contact row per yacht that has a named primary contact,
-- linked to both the org just created and the specific vessel.
insert into public.agency_contacts (id, name, contact_type, email, phone, org_id, vessel_id, created_at)
select
  gen_random_uuid(),
  y.contact_person,
  'primary',
  y.email_address,
  y.contact_no,
  y.org_id,
  y.id,
  now()
from public.yachts y
where y.contact_person is not null
  and trim(y.contact_person) <> '';

-- ============================================================
-- STEP 4: Add organisation_id to port_calls so a port call can be
-- tied to a client independent of vessel ownership/management changes.
-- ============================================================

alter table public.port_calls
  add column if not exists organisation_id uuid references public.organisations(org_id);

create index if not exists idx_port_calls_organisation_id on public.port_calls(organisation_id);

-- ============================================================
-- STEP 5: Fix assigned_office to a proper FK against offices,
-- replacing the free-text field. port_calls has 0 rows in production
-- at time of writing, so no data migration is required here.
--
-- v_inward_clearance_active (Port Calls module, migration 061) and
-- create_port_call (migration 061) both reference the old text column
-- and must be fixed BEFORE it's dropped, or the drop fails / the view
-- breaks. Fixed in steps 5a/5b below, in dependency order.
-- ============================================================

alter table public.port_calls
  add column if not exists assigned_office_id uuid references public.offices(id);

create index if not exists idx_port_calls_assigned_office_id on public.port_calls(assigned_office_id);

-- STEP 5a: repoint the Arrivals view at the new FK before dropping the
-- old column it currently selects. Output column stays named
-- "assigned_office" (now the office's name via join) so the Port Calls
-- frontend (PortCallsList.tsx) needs no change.
create or replace view public.v_inward_clearance_active as
select
  pc.id as port_call_id,
  y.vessel_name as vessel_name,
  pc.eta,
  pcs.label as status_label,
  o.name as assigned_office,
  pc.assigned_agent_id,
  count(*) filter (where wfs.status = 'pending') as steps_outstanding,
  count(*) filter (where wfs.status = 'completed') as steps_completed,
  count(*) as steps_total
from public.port_calls pc
join public.yachts y on y.id = pc.vessel_id
join public.port_call_status pcs on pcs.id = pc.status_id
left join public.offices o on o.id = pc.assigned_office_id
left join public.port_call_workflow_steps wfs
  on wfs.port_call_id = pc.id
  and wfs.workflow_definition_id = (
    select id from public.workflow_definitions where code = 'inward_clearance'
  )
where pcs.code not in ('completed')
group by pc.id, y.vessel_name, pc.eta, pcs.label, o.name, pc.assigned_agent_id;

alter view public.v_inward_clearance_active set (security_invoker = true);

-- STEP 5b: create_port_call took a free-text office; now takes the FK.
-- Parameter type is changing, so the old overload must be dropped first
-- (create or replace only replaces a function with an IDENTICAL
-- signature — a type change creates a second overload instead).
drop function if exists public.create_port_call(uuid, uuid, timestamptz, timestamptz, text, uuid, uuid);

create function public.create_port_call(
  p_vessel_id uuid,
  p_destination_country_id uuid,
  p_eta timestamptz,
  p_etd timestamptz,
  p_assigned_office_id uuid,
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
    assigned_office_id, assigned_agent_id, status_id, created_by
  ) values (
    p_vessel_id, p_destination_country_id, p_eta, p_etd,
    p_assigned_office_id, p_assigned_agent_id, v_initial_status_id, p_created_by
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

grant execute on function public.create_port_call to authenticated;

alter table public.port_calls
  drop column if exists assigned_office;

commit;
