-- Link crew members to their SharePoint source item (e.g. the "Visa" crew list) for sync matching.
alter table public.crew_members add column if not exists sharepoint_item_id   text;
alter table public.crew_members add column if not exists sharepoint_synced_at timestamptz;
create index if not exists crew_members_sp_item_idx on public.crew_members (sharepoint_item_id);
