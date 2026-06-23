-- ============================================================
-- Migration — index automation_runs for the Automations dashboard
-- ============================================================
-- Speeds up the per-automation run aggregation (hits / errors / retries) shown in
-- Developer → Automations.
CREATE INDEX IF NOT EXISTS idx_automation_runs_key_started
  ON public.automation_runs (automation_key, started_at DESC);
