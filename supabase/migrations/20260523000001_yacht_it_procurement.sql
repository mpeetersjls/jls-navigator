-- Yacht IT Solutions contracts/subscriptions/licenses
create table if not exists public.yacht_it_contracts (
  id              uuid        primary key default gen_random_uuid(),
  yacht_name      text        not null,
  service_name    text        not null,
  vendor          text,
  category        text        not null default 'other',
  charge_amount   numeric(12,2),
  cost_amount     numeric(12,2),
  billing_cycle   text        not null default 'monthly',
  start_date      date,
  expiry_date     date,
  status          text        not null default 'active',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.yacht_it_contracts enable row level security;
create policy "Authenticated users can manage yacht_it_contracts"
  on public.yacht_it_contracts for all
  using (auth.role() = 'authenticated');
create trigger yacht_it_contracts_updated_at
  before update on public.yacht_it_contracts
  for each row execute function public.set_updated_at();

-- Procurement items
create table if not exists public.procurement_items (
  id              uuid        primary key default gen_random_uuid(),
  request_no      text,
  yacht_name      text        not null,
  vendor          text        not null,
  description     text        not null,
  category        text        not null default 'other',
  quantity        integer     not null default 1,
  unit_price      numeric(12,2),
  total_amount    numeric(12,2),
  currency        text        not null default 'AED',
  invoice_ref     text,
  status          text        not null default 'requested',
  requested_date  date        not null default current_date,
  ordered_date    date,
  received_date   date,
  requested_by    text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.procurement_items enable row level security;
create policy "Authenticated users can manage procurement_items"
  on public.procurement_items for all
  using (auth.role() = 'authenticated');
create trigger procurement_items_updated_at
  before update on public.procurement_items
  for each row execute function public.set_updated_at();
