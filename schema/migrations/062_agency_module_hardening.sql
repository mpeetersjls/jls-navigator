-- Migration 062: Security-advisor fixes for the Agency Module slice
-- (migrations 056-061). Applied after get_advisors flagged two issues:
--
-- 1. v_inward_clearance_active defaulted to security-definer view
--    behaviour (Postgres 15+ views run as the view owner unless
--    security_invoker=true is set) — this would silently bypass
--    port_calls/yachts RLS for anyone who can SELECT the view, and
--    would defeat the ticket #205 RLS-hardening pass entirely since
--    tightening the base tables wouldn't restrict the view.
-- 2. get_port_call_compliance and set_updated_at had a mutable search_path.

alter view public.v_inward_clearance_active set (security_invoker = true);

create or replace function public.get_port_call_compliance(p_port_call_id uuid)
returns text
language sql
security invoker
stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.port_call_documents d
      where d.port_call_id = p_port_call_id
        and d.is_mandatory
        and d.validation_status in ('invalid', 'expired')
    ) then 'critical'
    when exists (
      select 1 from public.port_call_documents d
      where d.port_call_id = p_port_call_id
        and d.is_mandatory
        and d.validation_status = 'pending'
    ) then 'action_required'
    else 'compliant'
  end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
