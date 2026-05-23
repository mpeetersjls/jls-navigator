-- Delivery Drivers table
create table if not exists public.delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  license_number text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_drivers enable row level security;

create policy "auth users can manage delivery_drivers" on public.delivery_drivers
  for all to authenticated using (true) with check (true);

create trigger set_delivery_drivers_updated_at
  before update on public.delivery_drivers
  for each row execute function set_updated_at();

-- Deliveries table
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references public.packages(id) on delete set null,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  yacht_id uuid references public.yachts(id) on delete set null,
  scheduled_date date,
  completed_date date,
  pickup_address text,
  dropoff_address text,
  status text not null default 'scheduled',
  priority text not null default 'normal',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliveries enable row level security;

create policy "auth users can manage deliveries" on public.deliveries
  for all to authenticated using (true) with check (true);

create trigger set_deliveries_updated_at
  before update on public.deliveries
  for each row execute function set_updated_at();
