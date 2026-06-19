-- Migration 036 — Visa application supporting-docs columns
-- Adds columns written by api.visa.supporting-docs handler (previously missing from schema)
-- and crew_verification_letter_file_id for JLS-issued letter tracking.

ALTER TABLE visa_applications
  ADD COLUMN IF NOT EXISTS seamans_book_uploaded         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seamans_book_file_id          text,
  ADD COLUMN IF NOT EXISTS supporting_letter_requested   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supporting_letter_authorised  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alternative_docs_declared     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documents_confirmed           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crew_verification_letter_file_id text;
