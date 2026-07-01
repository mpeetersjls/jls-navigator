-- Migration 068: Anon-execute audit follow-up (5 functions unrelated to
-- Port Calls, flagged by the same security advisor sweep as 066/067).
--
-- Confirmed anon-executable via information_schema.routine_privileges
-- (not just the advisor cache) before writing this: admin_user_stats,
-- next_doc_number, next_shipsync_delivery_number, orbit_log_activity,
-- propagate_crew_movement, qbo_finance_dashboard. has_role was checked
-- and is NOT anon-executable (authenticated-only already) — no action
-- needed there.
--
-- Two of these are a real data-exposure risk, not just hygiene:
--   qbo_finance_dashboard(p_year) returns real QuickBooks figures —
--     revenue, outstanding balances, and customer names — to anyone
--     with no login at all.
--   admin_user_stats() returns platform-wide user/session counts with
--     no auth and no admin check despite the name.
-- Both get an internal role check in addition to the anon revoke, so an
-- authenticated-but-unauthorized user is also correctly rejected (the
-- grant alone only gates "logged in or not", not "allowed to see this").
--
-- next_doc_number / next_shipsync_delivery_number: anon-only revoke.
-- These allocate document/delivery sequence numbers for legitimate
-- authenticated app flows — revoking `authenticated` would break them.
-- Low severity (numbering-integrity, not data exposure) so no internal
-- check added.
--
-- orbit_log_activity / propagate_crew_movement: trigger functions
-- (RETURNS trigger, reference NEW/OLD/TG_OP). Triggers fire with the
-- definer's privileges automatically and never need a direct EXECUTE
-- grant to any role — revoking anon/authenticated/public entirely is
-- correct and doesn't affect their trigger behaviour at all.

-- 1. qbo_finance_dashboard — admin or finance-module access required.
-- Converted from `language sql` to `language plpgsql` so it can raise a
-- real exception on denial, rather than returning a fake "error" string
-- as a 200 OK jsonb payload (which is what a `sql`-language CASE would
-- have forced, since it can't do imperative control flow).
create or replace function public.qbo_finance_dashboard(p_year integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not (
    public.is_polaris_global_admin(auth.uid())
    or exists (
      select 1 from public.user_module_access uma
      join public.modules m on m.module_id = uma.module_id
      where uma.user_id = auth.uid()
        and m.name = 'finance'
        and coalesce(uma.active, true)
    )
  ) then
    raise exception 'Access denied: finance permission required';
  end if;

  return (
    with inv as (
      select * from public.qbo_invoices
      where doc_type = 'invoice' and (p_year is null or extract(year from txn_date) = p_year)
    ), pay as (
      select * from public.qbo_payments where (p_year is null or extract(year from txn_date) = p_year)
    )
    select jsonb_build_object(
      'invoice_count',     (select count(*) from inv),
      'invoiced_total',    coalesce((select sum(total_amt) from inv), 0),
      'outstanding_total', coalesce((select sum(balance) from inv), 0),
      'paid_total',        coalesce((select sum(total_amt - coalesce(balance,0)) from inv), 0),
      'payments_total',    coalesce((select sum(total_amt) from pay), 0),
      'payments_count',    (select count(*) from pay),
      'paid_count',        (select count(*) from inv where status = 'Paid'),
      'unpaid_count',      (select count(*) from inv where status = 'Unpaid'),
      'partial_count',     (select count(*) from inv where status = 'Partial'),
      'overdue_count',     (select count(*) from inv where status = 'Overdue'),
      'overdue_total',     coalesce((select sum(balance) from inv where status = 'Overdue'), 0),
      'top_outstanding',   (select coalesce(jsonb_agg(t order by t.outstanding desc), '[]'::jsonb)
                            from (select customer_name, sum(balance) as outstanding, count(*) as invoices
                                  from inv where balance > 0.005 group by customer_name
                                  order by sum(balance) desc limit 8) t),
      'recent_payments',   (select coalesce(jsonb_agg(t order by t.txn_date desc), '[]'::jsonb)
                            from (select customer_name, total_amt, txn_date from pay order by txn_date desc limit 8) t),
      'by_month',          (select coalesce(jsonb_agg(t order by t.m), '[]'::jsonb)
                            from (select to_char(date_trunc('month', txn_date), 'YYYY-MM') as m,
                                         sum(total_amt) as invoiced, sum(balance) as outstanding, count(*) as n
                                  from inv where txn_date is not null group by 1 order by 1) t)
    )
  );
end;
$function$;

revoke execute on function public.qbo_finance_dashboard(integer) from anon;

-- 2. admin_user_stats — global-admin only
create or replace function public.admin_user_stats()
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  if not public.is_polaris_global_admin(auth.uid()) then
    raise exception 'Access denied: admin access required';
  end if;

  return json_build_object(
    'total_users',     (select count(*) from public.user_profiles),
    'mfa_enrolled',    (select count(*) from public.user_profiles where mfa_enabled),
    'active_sessions', (select count(*) from auth.sessions where not_after is null or not_after > now()),
    'audit_today',     (select count(*) from public.audit_log where created_at >= date_trunc('day', now()))
  );
end;
$function$;

revoke execute on function public.admin_user_stats() from anon;

-- 3. Sequence allocators — anon-only revoke, authenticated keeps working
revoke execute on function public.next_doc_number(text, bigint) from anon;
revoke execute on function public.next_shipsync_delivery_number() from anon;

-- 4. Trigger-only functions — never meant to be called directly by anyone
revoke all on function public.orbit_log_activity() from public, anon, authenticated;
revoke all on function public.propagate_crew_movement() from public, anon, authenticated;
