-- The printed invoice line heading differs from the QBO Item name
-- (e.g. Item "Crew Visa (6 months)" prints as "UAE 6 Months Cabin Crew Visa per pax").
alter table public.qbo_item_map add column if not exists description_label text;

update public.qbo_item_map set description_label = 'UAE 6 Months Cabin Crew Visa per pax'
  where scope='visa' and qbo_item_name='Crew Visa (6 months)';
update public.qbo_item_map set description_label = 'UAE 6 Months Cabin Crew Visa Cancellation per pax'
  where scope='visa' and qbo_item_name='Crew Visa - Cancellation';
update public.qbo_item_map set description_label = 'Inside the country visa Status Change - 6 Months UAE Cabin Crew Visa'
  where scope='visa' and qbo_item_name='Crew Visa - Status Change';
update public.qbo_item_map set description_label = 'UAE Cabin Crew Visa On Arrival per pax'
  where scope='visa' and qbo_item_name='Crew Visa - On Arrival';
update public.qbo_item_map set description_label = 'UAE 96 Hours Cabin Crew Visa per pax'
  where scope='visa' and qbo_item_name='Crew Visa (96 hours)';
update public.qbo_item_map set description_label = 'UAE Tourist Visa per pax'
  where scope='visa' and qbo_item_name='Crew Visa - Tourist Visas';
