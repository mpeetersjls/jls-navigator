-- Migration 058: Port Call core record (FRS §3)
-- FK targets confirmed (ticket #196): agent/staff identity is
-- public.user_profiles(user_id); vessels are public.yachts(id) — this
-- repo has no public.staff or public.vessels table.

create table if not exists public.port_calls (
  id uuid primary key default gen_random_uuid(),

  -- Vessel reference (vessel particulars live in public.yachts)
  vessel_id uuid not null references public.yachts(id),

  -- Voyage information (FRS §3)
  previous_port text,
  next_port text,
  eta timestamptz,
  etd timestamptz,
  destination_country_id uuid references public.countries(id),
  assigned_office text,
  assigned_agent_id uuid references public.user_profiles(user_id),

  -- Status (configurable, see migration 057)
  status_id uuid not null references public.port_call_status(id),

  -- Finance stub (FRS §16) — read-only gate for "Cleared to Sail",
  -- no QuickBooks API calls in this slice.
  finance_status text not null default 'pda_pending' check (finance_status in (
    'pda_pending', 'pda_sent', 'funds_received', 'invoiced', 'paid', 'on_hold'
  )),

  created_by uuid references public.user_profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.port_calls is
  'Single source of truth for a vessel port call (FRS §1/§3). Every
   service, document, permit and workflow step links back to a
   port_calls row. Crew visa/passport/immigration data is explicitly
   excluded — owned entirely by the Immigration Module.';

create index if not exists idx_port_calls_vessel on public.port_calls (vessel_id);
create index if not exists idx_port_calls_status on public.port_calls (status_id);
create index if not exists idx_port_calls_eta on public.port_calls (eta);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_port_calls_updated_at on public.port_calls;
create trigger trg_port_calls_updated_at
  before update on public.port_calls
  for each row execute function public.set_updated_at();

alter table public.port_calls enable row level security;

-- Read: any authenticated agency-side user. Tighten with an
-- assigned_office / role check in the ticket #205 hardening pass.
create policy port_calls_select on public.port_calls
  for select using (auth.role() = 'authenticated');

-- Direct client writes are NOT permitted — all mutation goes through the
-- SECURITY DEFINER functions in migration 061, matching the Visa module's
-- read/write separation rule. No insert/update/delete policy is added
-- here on purpose.
