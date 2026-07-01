-- Migration 063: Lock down RLS on public reference/lookup tables
-- Ticket #206. Supabase security advisor flagged RLS fully disabled on:
--   public.languages
--   public.country_language_map
--   public.country_dial_codes
-- (migrations 054/055) — anon key could read AND write every row.
--
-- Confirmed before writing this (see ticket #206 research):
--   - Every current app read/write against these three tables goes through
--     the service-role key (src/routes/api.phone.ts, api.native-language.
--     resolve-default.ts, and their server-side lib helpers), which bypasses
--     RLS entirely. So this migration is defense-in-depth — it does not
--     change any existing application behaviour.
--   - Reads are intentionally guest-accessible (pre-login phone/native
--     language flows use a guest-token cookie, no auth required), so the
--     SELECT policy allows anon + authenticated, unlike the `authenticated`
--     -only pattern used for countries/country_requirement_config in
--     migration 056 (those are only ever read by logged-in staff).
--   - No admin UI writes to these tables yet — only the seed data in
--     migrations 054/055. Writes are restricted to
--     public.is_polaris_global_admin() (defined in migration 056), the
--     same admin-write pattern already established there. Service role
--     (used by any future admin API route) always bypasses RLS regardless.

alter table public.languages enable row level security;
alter table public.country_language_map enable row level security;
alter table public.country_dial_codes enable row level security;

-- Public read — these are non-sensitive reference lookups, and the
-- phone/native-language pickers must work before login.
create policy languages_select on public.languages
  for select using (true);
create policy country_language_map_select on public.country_language_map
  for select using (true);
create policy country_dial_codes_select on public.country_dial_codes
  for select using (true);

-- Writes restricted to global admin. Combined with the permissive select
-- policies above, this leaves insert/update/delete as the only commands
-- actually gated by is_polaris_global_admin() (select is already granted
-- unconditionally by the policies above).
create policy languages_write_admin on public.languages
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
create policy country_language_map_write_admin on public.country_language_map
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
create policy country_dial_codes_write_admin on public.country_dial_codes
  for all using (public.is_polaris_global_admin(auth.uid()))
  with check (public.is_polaris_global_admin(auth.uid()));
