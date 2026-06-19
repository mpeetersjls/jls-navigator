-- ============================================================
-- Polaris — Crew Search Fix + Search Audit Infrastructure
-- POLARIS-SEARCH-002, POLARIS-SEARCH-003, POLARIS-SEARCH-008
-- ============================================================

-- ── 1. Fix the full_name trigger to include middle_name ─────
-- The original trigger only concatenated first_name + last_name,
-- discarding middle_name on every INSERT. This caused "Michael Jude Fetton"
-- to be stored as "Michael Fetton", breaking name searches.

CREATE OR REPLACE FUNCTION polaris_sync_crew_full_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.full_name := TRIM(
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NULLIF(TRIM(NEW.middle_name), '') || ' ', '') ||
    COALESCE(NEW.last_name, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crew_full_name ON crew_members;
CREATE TRIGGER trg_crew_full_name
  BEFORE INSERT OR UPDATE OF first_name, middle_name, last_name ON crew_members
  FOR EACH ROW EXECUTE FUNCTION polaris_sync_crew_full_name();

-- ── 2. Backfill existing records where middle_name exists ───
-- Re-sync full_name for any crew member who has a middle_name stored
-- but whose full_name is missing it (the legacy trigger omitted it).
UPDATE crew_members
   SET full_name = TRIM(
     COALESCE(first_name, '') || ' ' ||
     COALESCE(NULLIF(TRIM(middle_name), '') || ' ', '') ||
     COALESCE(last_name, '')
   )
 WHERE middle_name IS NOT NULL
   AND middle_name <> ''
   AND full_name NOT ILIKE '%' || middle_name || '%';

-- ── 3. Migration 030 — Search audit log ─────────────────────
-- Permanent structured log of every crew search attempt.
-- Zero-result searches are indexed separately for rapid diagnosis.
CREATE TABLE IF NOT EXISTS search_audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service    VARCHAR(50) NOT NULL,
  level      VARCHAR(10) NOT NULL CHECK (level IN ('INFO','WARN','ERROR')),
  payload    JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sal_service_level
  ON search_audit_log (service, level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sal_payload_zero
  ON search_audit_log ((payload->>'zeroResult'), created_at DESC)
  WHERE payload->>'zeroResult' = 'true';

-- ── 4. Migration 031 — Trigram search indexes ───────────────
-- Required for ILIKE '%partial%' queries to be fast at 2 500+ crew.
-- Without these, every search is a full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_crew_full_name_trgm
  ON crew_members
  USING GIN (LOWER(full_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_crew_lastname_trgm
  ON crew_members
  USING GIN (LOWER(last_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_crew_firstname_trgm
  ON crew_members
  USING GIN (LOWER(first_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_crew_dob
  ON crew_members (date_of_birth);
