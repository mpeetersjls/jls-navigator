-- ============================================================
-- Migration — QuickBooks doc-number self-heal backing store
-- ============================================================
-- Backs the QB invoice-number "heal" routine: an atomic per-prefix allocator plus
-- audit/alert logs. Used by the QB webhook automation (n8n today, porting to a
-- worker receiver). next_doc_number returns the next integer strictly above
-- max(stored high-water, floor), serialised per prefix so collisions never recur.
CREATE TABLE IF NOT EXISTS public.doc_number_seq (
  prefix     text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.next_doc_number(p_prefix text, p_floor bigint DEFAULT 0)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO doc_number_seq (prefix, last_value) VALUES (p_prefix, 0)
    ON CONFLICT (prefix) DO NOTHING;
  UPDATE doc_number_seq
    SET last_value = GREATEST(last_value, COALESCE(p_floor, 0)) + 1, updated_at = now()
    WHERE prefix = p_prefix
    RETURNING last_value INTO v;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(text, bigint) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.heal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id text, prefix text, old_doc_number text, new_doc_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.heal_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id text, old_doc_number text, reason text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.heal_audit  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heal_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS heal_audit_rw ON public.heal_audit;
CREATE POLICY heal_audit_rw ON public.heal_audit FOR ALL
  USING ((select auth.role()) = 'authenticated') WITH CHECK ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS heal_alerts_rw ON public.heal_alerts;
CREATE POLICY heal_alerts_rw ON public.heal_alerts FOR ALL
  USING ((select auth.role()) = 'authenticated') WITH CHECK ((select auth.role()) = 'authenticated');
