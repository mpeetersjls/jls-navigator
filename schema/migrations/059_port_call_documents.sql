-- Migration 059: Pre-arrival document checklist (FRS §8)
-- Checklist rows are generated from country_requirement_config — never
-- hand-entered per Port Call.

create table if not exists public.port_call_documents (
  id uuid primary key default gen_random_uuid(),
  port_call_id uuid not null references public.port_calls(id) on delete cascade,
  requirement_config_id uuid not null references public.country_requirement_config(id),
  code text not null,            -- denormalized from requirement_config for stable history
  label text not null,           -- denormalized at generation time
  is_mandatory boolean not null default true,

  file_path text,                -- storage path once uploaded
  version int not null default 1,
  expiry_date date,
  validation_status text not null default 'pending' check (validation_status in (
    'pending', 'valid', 'invalid', 'expired'
  )),
  approval_status text not null default 'pending' check (approval_status in (
    'pending', 'approved', 'rejected'
  )),

  uploaded_by uuid references public.user_profiles(user_id),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),

  unique (port_call_id, code)
);

comment on table public.port_call_documents is
  'Pre-arrival document checklist for a Port Call (FRS §8). One row per
   required document, generated from country_requirement_config when the
   Port Call is created or its destination country is set. Crew
   passports/visa documents are never stored here — Immigration Module
   only.';

create index if not exists idx_port_call_documents_port_call
  on public.port_call_documents (port_call_id);

-- Version history: prior versions are preserved, not overwritten.
create table if not exists public.port_call_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.port_call_documents(id) on delete cascade,
  version int not null,
  file_path text not null,
  uploaded_by uuid references public.user_profiles(user_id),
  uploaded_at timestamptz not null default now()
);

alter table public.port_call_documents enable row level security;
alter table public.port_call_document_versions enable row level security;

create policy port_call_documents_select on public.port_call_documents
  for select using (auth.role() = 'authenticated');
create policy port_call_document_versions_select on public.port_call_document_versions
  for select using (auth.role() = 'authenticated');

-- Mutation via SECURITY DEFINER functions only (migration 061) — no
-- direct insert/update/delete policy, consistent with port_calls.
