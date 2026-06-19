-- ============================================================
-- Polaris — Additional Personal Information
-- POLARIS-PINFO-001 + POLARIS-PINFO-002
-- ============================================================

-- ── 1. Personal info columns on crew_members ────────────────
ALTER TABLE crew_members
  ADD COLUMN IF NOT EXISTS nationality_citizenship    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS place_of_birth             VARCHAR(150),
  ADD COLUMN IF NOT EXISTS country_of_birth           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender                     VARCHAR(20)
    CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
  ADD COLUMN IF NOT EXISTS marital_status             VARCHAR(20)
    CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed')),
  ADD COLUMN IF NOT EXISTS native_language            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS occupation                 VARCHAR(50)
    CHECK (occupation IN ('Captain', 'Seaman')),
  ADD COLUMN IF NOT EXISTS mothers_maiden_name        VARCHAR(150),
  ADD COLUMN IF NOT EXISTS fathers_full_name          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS religion                   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ocr_populated_fields       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ocr_confirmed_fields       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS personal_info_completed_at TIMESTAMPTZ;

-- ── 2. OCR raw output on crew_passports ─────────────────────
ALTER TABLE crew_passports
  ADD COLUMN IF NOT EXISTS ocr_raw JSONB;
