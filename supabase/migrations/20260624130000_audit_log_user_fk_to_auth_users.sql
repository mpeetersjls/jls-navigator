-- Fix: "Vessel Visa Reports → Generate report" failed with
--   insert or update on table "audit_log" violates foreign key constraint
--   "audit_log_user_id_fkey"
--
-- generate_vessel_visa_report() logs the action to audit_log with the AUTH user
-- id, but the FK pointed at user_profiles(user_id) — and not every authenticated
-- user has a user_profiles row, so the audit insert (and the whole report) aborted.
-- user_profiles.user_id is itself the auth id, so point the FK at the canonical
-- auth.users(id): strictly more permissive, still correct, and null on user delete.

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
