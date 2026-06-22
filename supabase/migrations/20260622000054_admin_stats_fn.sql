-- ============================================================
-- Migration 054 — admin_user_stats() for the Admin Panel stat cards
-- ============================================================
-- SECURITY DEFINER so it can read auth.sessions (not reachable via PostgREST).
-- Active sessions = non-expired auth sessions. MFA enrolled = profiles flagged.
CREATE OR REPLACE FUNCTION public.admin_user_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'total_users',     (SELECT count(*) FROM public.user_profiles),
    'mfa_enrolled',    (SELECT count(*) FROM public.user_profiles WHERE mfa_enabled),
    'active_sessions', (SELECT count(*) FROM auth.sessions WHERE not_after IS NULL OR not_after > now()),
    'audit_today',     (SELECT count(*) FROM public.audit_log WHERE created_at >= date_trunc('day', now()))
  );
$$;
