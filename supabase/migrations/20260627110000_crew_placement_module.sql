-- Crew Placement / Payroll / Contracts module (managed & placed crew). Separate from the
-- core crew module; optionally links to a crew_members row, and a vessel association.

create table if not exists public.placed_crew (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text,
  phone           text,
  nationality     text,
  date_of_birth   date,
  rank            text,
  placement_type  text not null default 'managed', -- managed | placed | pool
  status          text not null default 'active',  -- active | available | inactive | onboard | on_leave
  yacht_id        uuid references public.yachts(id) on delete set null,
  crew_member_id  uuid,
  rotation        text,
  salary          numeric,
  currency        text default 'USD',
  start_date      date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.crew_placement_certs (
  id            uuid primary key default gen_random_uuid(),
  placed_crew_id uuid not null references public.placed_crew(id) on delete cascade,
  cert_type     text not null,
  cert_number   text,
  issuing_authority text,
  issued_date   date,
  expiry_date   date,
  document_path text,
  created_at    timestamptz not null default now()
);

create table if not exists public.crew_placement_documents (
  id            uuid primary key default gen_random_uuid(),
  placed_crew_id uuid not null references public.placed_crew(id) on delete cascade,
  doc_type      text not null default 'other',
  title         text not null,
  file_path     text,
  created_at    timestamptz not null default now()
);

create table if not exists public.crew_placement_templates (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                      -- contract | payslip
  name        text not null,
  body        text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.crew_contracts (
  id            uuid primary key default gen_random_uuid(),
  placed_crew_id uuid not null references public.placed_crew(id) on delete cascade,
  yacht_id      uuid references public.yachts(id) on delete set null,
  template_id   uuid references public.crew_placement_templates(id) on delete set null,
  contract_type text,
  start_date    date,
  end_date      date,
  salary        numeric,
  currency      text default 'USD',
  rotation      text,
  status        text not null default 'draft',
  values        jsonb,
  pdf_path      text,
  esign_document_id uuid,
  created_at    timestamptz not null default now()
);

create table if not exists public.crew_payslips (
  id            uuid primary key default gen_random_uuid(),
  placed_crew_id uuid not null references public.placed_crew(id) on delete cascade,
  template_id   uuid references public.crew_placement_templates(id) on delete set null,
  period_month  date not null,
  gross         numeric,
  deductions    jsonb,
  additions     jsonb,
  net           numeric,
  currency      text default 'USD',
  status        text not null default 'draft',
  pdf_path      text,
  created_at    timestamptz not null default now()
);

create index if not exists placed_crew_yacht_idx on public.placed_crew (yacht_id);
create index if not exists cpc_crew_idx on public.crew_placement_certs (placed_crew_id);
create index if not exists cpd_crew_idx on public.crew_placement_documents (placed_crew_id);
create index if not exists cc_crew_idx on public.crew_contracts (placed_crew_id);
create index if not exists cp_crew_idx on public.crew_payslips (placed_crew_id);

do $$ declare t text;
begin
  foreach t in array array['placed_crew','crew_placement_certs','crew_placement_documents','crew_placement_templates','crew_contracts','crew_payslips']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_auth on public.%I', t, t);
    execute format('create policy %I_auth on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
