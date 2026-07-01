-- Migration 091: ORBIT Small Boat Management — create_orbit_boat
-- The go-live spec only shipped update_orbit_boat_profile (edit) and
-- log_orbit_boat_engine_hours -- there is no insert path anywhere in the
-- vendor slice, which would leave the New View screen permanently empty
-- with no way to add a boat. Adding the missing create function,
-- following the same has_module_permission-gated, auth.uid()-derived
-- pattern as every other write function in this module.

create or replace function public.create_orbit_boat(p_boat jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_module_permission(auth.uid(), 'orbit', 'create') then
    raise exception 'Not authorized to create boats';
  end if;

  if coalesce(p_boat->>'name', '') = '' then
    raise exception 'Boat name is required';
  end if;

  insert into public.orbit_boats (
    name, registration, boat_type, length_m, manufacturer, model, year, hull_number,
    fuel_type, engine, has_trailer, assigned_department, small_boat_id
  ) values (
    p_boat->>'name',
    p_boat->>'registration',
    p_boat->>'boat_type',
    nullif(p_boat->>'length_m', '')::numeric,
    p_boat->>'manufacturer',
    p_boat->>'model',
    nullif(p_boat->>'year', '')::int,
    p_boat->>'hull_number',
    p_boat->>'fuel_type',
    p_boat->>'engine',
    coalesce((p_boat->>'has_trailer')::boolean, false),
    p_boat->>'assigned_department',
    nullif(p_boat->>'small_boat_id', '')::uuid
  )
  returning id into v_id;

  return v_id;
end; $$;

revoke all on function public.create_orbit_boat(jsonb) from public, anon;
grant execute on function public.create_orbit_boat(jsonb) to authenticated;
