-- Migration 092: Add the missing "Visa Application No" field.
--
-- Every Oman (and likely other countries') visa grant document carries
-- a Visa Application No distinct from the Visa Number, but Polaris never
-- captured it. Confirmed via direct schema inspection that no such
-- column exists under any name on visa_applications.

alter table public.visa_applications
  add column if not exists visa_application_no text;

comment on column public.visa_applications.visa_application_no is
  'Visa Application No from the grant document — distinct from
   visa_number. Previously not captured at all.';
