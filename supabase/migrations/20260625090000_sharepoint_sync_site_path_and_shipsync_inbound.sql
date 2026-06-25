-- Per-sync SharePoint site override so lists on another site (ShipSync's
-- JLS-DeliveriesApp) can be pulled through the same inbound sync engine.
alter table sharepoint_sync_configs add column if not exists site_path text;

-- Register ShipSync Packages + Drivers as inbound syncs (SharePoint = source of
-- truth, same as Yachts/Permits). Idempotent on sync_target.
insert into sharepoint_sync_configs (name, list_name, sync_target, site_path, enabled, field_mapping)
select 'ShipSync Packages', 'Packages', 'shipsync_packages', '/sites/JLS-DeliveriesApp', true,
  '{"Barcode":"barcode","Location":"boat_name","PackageOwner":"package_owner","Courier":"courier","NumberofPackages":"num_packages","Status":"status","WarehouseZone":"warehouse_zone","ScannedDate":"received_at","DriverScanDelivered":"delivered_at","DriverScanOut":"scan_out_time","DriverScanOutTime":"driver_scan_out_time","PlannedDeliveryDate":"planned_delivery_date","WhoScanned":"received_by","DeliveryComments":"description","FullNameReceiverOnDelivery":"receiver_full_name","DesignationReceiverOnDelivery":"receiver_designation","EmailAddressReceiverOnDelivery":"receiver_email","Supplier":"supplier","Origin":"origin","Commodity":"commodity","BOENo_x002e_":"boe_no","Package_x002d_Local_x002f_Import":"local_import","Decleration":"declaration"}'::jsonb
where not exists (select 1 from sharepoint_sync_configs where sync_target='shipsync_packages');

insert into sharepoint_sync_configs (name, list_name, sync_target, site_path, enabled, field_mapping)
select 'ShipSync Drivers', 'Drivers', 'shipsync_drivers', '/sites/JLS-DeliveriesApp', true,
  '{"Title":"name","EmailAddress":"email","MobileNumber":"phone"}'::jsonb
where not exists (select 1 from sharepoint_sync_configs where sync_target='shipsync_drivers');
