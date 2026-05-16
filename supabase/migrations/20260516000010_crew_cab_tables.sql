-- Crew Cab: Drivers
create table if not exists public.crew_drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  license_no text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crew_drivers enable row level security;
create policy "Authenticated users can manage crew_drivers"
  on public.crew_drivers for all using (auth.role() = 'authenticated');

-- Crew Cab: Vehicles
create table if not exists public.crew_vehicles (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  year integer,
  registration text,
  color text,
  capacity integer default 4,
  mileage integer default 0,
  status text not null default 'available',
  insurance_expiry date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crew_vehicles enable row level security;
create policy "Authenticated users can manage crew_vehicles"
  on public.crew_vehicles for all using (auth.role() = 'authenticated');

-- Crew Cab: Saved Locations
create table if not exists public.crew_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  category text default 'other',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crew_locations enable row level security;
create policy "Authenticated users can manage crew_locations"
  on public.crew_locations for all using (auth.role() = 'authenticated');

-- Crew Cab: Trips
create table if not exists public.crew_trips (
  id uuid primary key default gen_random_uuid(),
  trip_type text not null default 'crew_pickup',
  passenger_name text,
  yacht_id uuid references public.yachts(id) on delete set null,
  pickup_location_id uuid references public.crew_locations(id) on delete set null,
  pickup_address text,
  dropoff_location_id uuid references public.crew_locations(id) on delete set null,
  dropoff_address text,
  pickup_datetime timestamptz,
  dropoff_datetime timestamptz,
  driver_id uuid references public.crew_drivers(id) on delete set null,
  vehicle_id uuid references public.crew_vehicles(id) on delete set null,
  status text not null default 'pending',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crew_trips enable row level security;
create policy "Authenticated users can manage crew_trips"
  on public.crew_trips for all using (auth.role() = 'authenticated');
