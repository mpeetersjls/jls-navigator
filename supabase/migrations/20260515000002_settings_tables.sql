-- Extra fields on permits for sanitation-specific data
alter table public.permits
  add column if not exists contact_email text,
  add column if not exists preferred_inspection_date date,
  add column if not exists jls_quotation_number text;

-- Email templates
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  permit_type text,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;
create policy "Authenticated users can view email templates"
  on public.email_templates for select using (auth.role() = 'authenticated');
create policy "Admins can manage email templates"
  on public.email_templates for all
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Integration settings
create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  integration_name text not null unique,
  config jsonb not null default '{}',
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.integration_settings enable row level security;
create policy "Authenticated users can view integration settings"
  on public.integration_settings for select using (auth.role() = 'authenticated');
create policy "Admins can manage integration settings"
  on public.integration_settings for all
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Storage bucket for permit documents
insert into storage.buckets (id, name, public)
values ('permit-documents', 'permit-documents', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload permit documents"
  on storage.objects for insert
  with check (bucket_id = 'permit-documents' and auth.role() = 'authenticated');

create policy "Public can view permit documents"
  on storage.objects for select
  using (bucket_id = 'permit-documents');

create policy "Authenticated users can delete permit documents"
  on storage.objects for delete
  using (bucket_id = 'permit-documents' and auth.role() = 'authenticated');
