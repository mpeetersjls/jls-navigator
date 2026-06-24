-- Image storage for ShipSync (item photos, delivery photos, signatures).
INSERT INTO storage.buckets (id, name, public)
VALUES ('shipsync', 'shipsync', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS shipsync_obj_read ON storage.objects;
CREATE POLICY shipsync_obj_read ON storage.objects FOR SELECT USING (bucket_id = 'shipsync');
DROP POLICY IF EXISTS shipsync_obj_write ON storage.objects;
CREATE POLICY shipsync_obj_write ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shipsync' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS shipsync_obj_update ON storage.objects;
CREATE POLICY shipsync_obj_update ON storage.objects FOR UPDATE USING (bucket_id = 'shipsync' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS shipsync_obj_delete ON storage.objects;
CREATE POLICY shipsync_obj_delete ON storage.objects FOR DELETE USING (bucket_id = 'shipsync' AND auth.role() = 'authenticated');
