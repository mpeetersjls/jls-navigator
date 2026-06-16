-- Add Passport: multiple attachments + self-attestation
-- (passport cover, headshot, seaman's book; data-page scan stays in document_url).
ALTER TABLE crew_passports
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS headshot_url text,
  ADD COLUMN IF NOT EXISTS seamans_book_url text,
  ADD COLUMN IF NOT EXISTS no_seamans_book boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS double_checked boolean NOT NULL DEFAULT false;
