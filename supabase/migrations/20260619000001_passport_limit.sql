-- Migration 028 addendum: add UNIQUE constraint + 3-passport limit trigger
-- crew_passports already exists (created in 20260610000010_visa_module.sql)
-- This migration adds what was missing from the original spec.

-- Unique passport number per crew member (not globally unique)
ALTER TABLE crew_passports
  ADD CONSTRAINT IF NOT EXISTS uq_crew_passport_number
  UNIQUE (crew_id, passport_number);

-- Enforce max 3 passports per crew member at DB level
CREATE OR REPLACE FUNCTION check_passport_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM crew_passports WHERE crew_id = NEW.crew_id) >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 passports allowed per crew member';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_passport_limit ON crew_passports;
CREATE TRIGGER enforce_passport_limit
  BEFORE INSERT ON crew_passports
  FOR EACH ROW EXECUTE FUNCTION check_passport_limit();

-- Migration 029: link selected passport to visa application
ALTER TABLE visa_applications
  ADD COLUMN IF NOT EXISTS selected_passport_id UUID REFERENCES crew_passports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visa_selected_passport ON visa_applications(selected_passport_id)
  WHERE selected_passport_id IS NOT NULL;
