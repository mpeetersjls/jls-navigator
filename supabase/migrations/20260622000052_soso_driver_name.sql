-- ============================================================
-- Migration 052 — SOSO Phase 3: free-text driver name on movements
-- ============================================================
-- driver_assigned (uuid) anticipates a future driver-user picker; until that
-- exists, capture the driver as free text.
ALTER TABLE public.crew_signon_events ADD COLUMN IF NOT EXISTS driver_name text;
