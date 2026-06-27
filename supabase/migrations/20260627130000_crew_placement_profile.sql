-- Department (ship/department-grouped view) + bank accounts (Finance tab).
alter table public.placed_crew add column if not exists department text;

create table if not exists public.placed_crew_bank (
  id              uuid primary key default gen_random_uuid(),
  placed_crew_id  uuid not null references public.placed_crew(id) on delete cascade,
  account_holder  text,
  account_currency text default 'EUR',
  account_country text,
  iban            text,
  bic             text,
  bank_name       text,
  bank_country    text,
  created_at      timestamptz not null default now()
);
create index if not exists pcb_crew_idx on public.placed_crew_bank (placed_crew_id);
alter table public.placed_crew_bank enable row level security;
drop policy if exists placed_crew_bank_auth on public.placed_crew_bank;
create policy placed_crew_bank_auth on public.placed_crew_bank for all to authenticated using (true) with check (true);
