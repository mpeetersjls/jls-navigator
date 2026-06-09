-- Live AIS position + voyage state persisted onto yachts (VesselFinder Fleet Positions API).
-- Populated by syncVesselPositions() on the ~15-min Worker cron (no-op until the
-- VESSELFINDER_USERKEY secret is set). Surfaced as Vessel Overview columns.
alter table public.yachts add column if not exists ais_lat          numeric;
alter table public.yachts add column if not exists ais_lon          numeric;
alter table public.yachts add column if not exists ais_speed        numeric;   -- knots
alter table public.yachts add column if not exists ais_course       numeric;
alter table public.yachts add column if not exists ais_heading      numeric;
alter table public.yachts add column if not exists ais_navstat      integer;   -- AIS navigational status code
alter table public.yachts add column if not exists ais_destination  text;
alter table public.yachts add column if not exists ais_eta          text;
alter table public.yachts add column if not exists ais_position_at  timestamptz;
alter table public.yachts add column if not exists underway_since   timestamptz;
alter table public.yachts add column if not exists last_departed_at timestamptz;
alter table public.yachts add column if not exists last_arrived_at  timestamptz;
alter table public.yachts add column if not exists ais_synced_at    timestamptz;
