-- ============================================================
-- Migration — Internal JLS IT services / subscriptions
-- ============================================================
-- Tracks services & subscriptions JLS pays for internally (M365, GitHub, hosting,
-- security tools, connectivity, etc.) — cost-only, not client-billed. Client-facing
-- services live in yacht_it_contracts. Mirrors the authenticated-CRUD RLS of the
-- other IT tables.
CREATE TABLE IF NOT EXISTS public.internal_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name  text NOT NULL,
  vendor        text,
  category      text NOT NULL DEFAULT 'other',     -- software | connectivity | security | infrastructure | support | other
  cost_amount   numeric,
  currency      text NOT NULL DEFAULT 'AED',
  billing_cycle text NOT NULL DEFAULT 'monthly',   -- monthly | quarterly | annual | one_off
  seats         integer,
  owner         text,                               -- responsible person / department
  account_ref   text,                               -- account / login reference
  start_date    date,
  renewal_date  date,
  status        text NOT NULL DEFAULT 'active',      -- active | cancelled
  notes         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_services_renewal ON public.internal_services (renewal_date);

ALTER TABLE public.internal_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_internal_services ON public.internal_services;
CREATE POLICY authenticated_all_internal_services ON public.internal_services
  FOR ALL USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');
