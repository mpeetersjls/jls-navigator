-- ============================================================
-- Migration 051 — SOSO Phase 2: auto-propagation on crew movement
-- ============================================================
-- "One entry, everything updates." When a crew_signon_events row is inserted,
-- propagate it across the platform IN THE SAME TRANSACTION (atomic — rolls back
-- with the insert on any error):
--   ⑤ append a crew_timeline_events row
--   ② set the crew member's current vessel (yacht_id) on sign-on
--   ③ stamp the movement date onto the crew's most recent visa application
--   ⑥⑦ raise in-app notifications to admin / ops users
-- (Email notifications are sent from the app layer — see the movement save path.)
-- crew_members.status is deliberately left untouched: that column carries
-- heterogeneous SharePoint-synced values and is maintained by the save path.

CREATE OR REPLACE FUNCTION public.propagate_crew_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew_name text;
  v_vessel    text;
  v_tl_type   text;
  v_when      timestamptz;
BEGIN
  v_tl_type := CASE WHEN NEW.event_type = 'sign_off' THEN 'SIGN_OFF' ELSE 'SIGN_ON' END;
  v_when    := COALESCE(NEW.departure_datetime, NEW.arrival_datetime, NEW.event_date::timestamptz, now());

  SELECT COALESCE(c.full_name, NULLIF(trim(concat(c.first_name, ' ', c.last_name)), ''), 'Crew member')
    INTO v_crew_name FROM crew_members c WHERE c.id = NEW.crew_member_id;
  SELECT y.vessel_name INTO v_vessel FROM yachts y WHERE y.id = NEW.yacht_id;

  -- ⑤ append-only timeline event
  INSERT INTO crew_timeline_events
    (crew_member_id, yacht_id, event_type, event_datetime, reference_id, reference_type, notes, created_by)
  VALUES
    (NEW.crew_member_id, NEW.yacht_id, v_tl_type, v_when, NEW.id, 'crew_signon_event', NEW.port, NEW.created_by);

  -- ② current vessel on sign-on
  IF v_tl_type = 'SIGN_ON' AND NEW.yacht_id IS NOT NULL THEN
    UPDATE crew_members SET yacht_id = NEW.yacht_id, updated_at = now() WHERE id = NEW.crew_member_id;
  END IF;

  -- ③ propagate the movement date onto the crew's most recent visa application
  IF v_tl_type = 'SIGN_ON' THEN
    UPDATE visa_applications SET sign_on_date = NEW.event_date
     WHERE id = (SELECT id FROM visa_applications WHERE crew_member_id = NEW.crew_member_id ORDER BY created_at DESC LIMIT 1);
  ELSE
    UPDATE visa_applications SET sign_off_date = NEW.event_date
     WHERE id = (SELECT id FROM visa_applications WHERE crew_member_id = NEW.crew_member_id ORDER BY created_at DESC LIMIT 1);
  END IF;

  -- ⑥⑦ in-app notifications to admin / ops users
  INSERT INTO notifications (user_id, type, urgency, title, body, action_url)
  SELECT up.user_id, 'crew_movement', 'info',
         CASE WHEN v_tl_type = 'SIGN_ON' THEN 'Crew sign-on' ELSE 'Crew sign-off' END,
         v_crew_name
           || CASE WHEN v_tl_type = 'SIGN_ON' THEN ' signed on' ELSE ' signed off' END
           || COALESCE(' — ' || v_vessel, '')
           || COALESCE(' on ' || to_char(NEW.event_date, 'DD Mon YYYY'), ''),
         '/crew-immigration/crew/' || NEW.crew_member_id
    FROM user_profiles up
    JOIN roles r ON r.role_id = up.role_id
   WHERE r.name IN ('global_admin', 'org_admin') AND COALESCE(up.active, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_crew_movement ON public.crew_signon_events;
CREATE TRIGGER trg_propagate_crew_movement
  AFTER INSERT ON public.crew_signon_events
  FOR EACH ROW EXECUTE FUNCTION public.propagate_crew_movement();
