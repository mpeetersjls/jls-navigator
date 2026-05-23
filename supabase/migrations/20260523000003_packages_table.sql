-- Packages & Deliveries table
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid references public.yachts(id) on delete set null,
  tracking_number text,
  carrier text,
  description text,
  sender_name text,
  recipient_name text,
  received_date date,
  delivered_date date,
  status text not null default 'received',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.packages enable row level security;

create policy "auth users can manage packages" on public.packages
  for all to authenticated using (true) with check (true);

create trigger set_packages_updated_at
  before update on public.packages
  for each row execute function set_updated_at();
