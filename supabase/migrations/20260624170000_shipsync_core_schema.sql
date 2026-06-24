-- ShipSync core schema — drivers, destinations, delivery notes, packages.
-- Supabase is the source of truth; a cron pushes changes back to SharePoint.

CREATE TABLE IF NOT EXISTS public.shipsync_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, email text, phone text, vehicle text,
  active boolean NOT NULL DEFAULT true, user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipsync_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_name text NOT NULL UNIQUE, yacht_id uuid,
  address text, lat numeric, lng numeric, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipsync_delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE, boat_name text, yacht_id uuid,
  driver_id uuid REFERENCES public.shipsync_drivers(id) ON DELETE SET NULL,
  destination_address text, destination_lat numeric, destination_lng numeric,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dispatched','delivered','cancelled')),
  predelivery_pdf_url text, delivery_pdf_url text, delivered_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), sp_synced_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.shipsync_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text, boat_name text, yacht_id uuid, package_owner text, courier text,
  num_packages int NOT NULL DEFAULT 1, priority int, local_import text, declaration text,
  vat numeric, duty numeric, warehouse_zone text,
  status text NOT NULL DEFAULT 'in_office'
    CHECK (status IN ('in_office','in_storage','assigned','out_for_delivery','delivered','to_collect','collected','refused')),
  delivery_note_id uuid REFERENCES public.shipsync_delivery_notes(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.shipsync_drivers(id) ON DELETE SET NULL,
  received_at timestamptz DEFAULT now(), received_by text, planned_delivery_date date,
  description text, phase_status text, scan_out_time timestamptz,
  driver_scanned boolean NOT NULL DEFAULT false, driver_scan_out_time timestamptz, delivered_at timestamptz,
  receiver_full_name text, receiver_designation text, receiver_email text,
  signature_url text, delivery_photo_url text, item_photo_url text, office_photo_url text,
  boe_no text, trade_type text, supplier text, origin text, commodity text, weight_kg numeric,
  edas_required boolean, extra jsonb,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), sp_synced_at timestamptz
);

CREATE SEQUENCE IF NOT EXISTS public.shipsync_delivery_note_seq START 1;
CREATE OR REPLACE FUNCTION public.next_shipsync_delivery_number()
  RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT lpad(nextval('public.shipsync_delivery_note_seq')::text, 4, '0');
$$;

CREATE INDEX IF NOT EXISTS shipsync_pkg_barcode_idx ON public.shipsync_packages (barcode);
CREATE INDEX IF NOT EXISTS shipsync_pkg_boat_idx    ON public.shipsync_packages (boat_name);
CREATE INDEX IF NOT EXISTS shipsync_pkg_status_idx  ON public.shipsync_packages (status);
CREATE INDEX IF NOT EXISTS shipsync_pkg_note_idx    ON public.shipsync_packages (delivery_note_id);
CREATE INDEX IF NOT EXISTS shipsync_pkg_driver_idx  ON public.shipsync_packages (driver_id);
CREATE INDEX IF NOT EXISTS shipsync_pkg_zone_idx    ON public.shipsync_packages (warehouse_zone);
CREATE INDEX IF NOT EXISTS shipsync_pkg_spsync_idx  ON public.shipsync_packages (sp_synced_at, updated_at);
CREATE INDEX IF NOT EXISTS shipsync_note_driver_idx ON public.shipsync_delivery_notes (driver_id);
CREATE INDEX IF NOT EXISTS shipsync_note_status_idx ON public.shipsync_delivery_notes (status);

CREATE OR REPLACE FUNCTION public.shipsync_touch_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS shipsync_pkg_touch ON public.shipsync_packages;
CREATE TRIGGER shipsync_pkg_touch BEFORE UPDATE ON public.shipsync_packages
  FOR EACH ROW EXECUTE FUNCTION public.shipsync_touch_updated_at();
DROP TRIGGER IF EXISTS shipsync_note_touch ON public.shipsync_delivery_notes;
CREATE TRIGGER shipsync_note_touch BEFORE UPDATE ON public.shipsync_delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.shipsync_touch_updated_at();

ALTER TABLE public.shipsync_drivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipsync_destinations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipsync_delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipsync_packages       ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['shipsync_drivers','shipsync_destinations','shipsync_delivery_notes','shipsync_packages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_authed', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t||'_authed', t);
  END LOOP;
END $$;
