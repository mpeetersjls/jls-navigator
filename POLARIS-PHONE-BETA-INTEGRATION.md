# POLARIS — TELEPHONE NUMBER ENHANCEMENTS: BETA COMPLETION
# Migration: 055 · Ticket: assign next
# Author: Captain Mike — JLS Yachts LLC
# Developer: Matt Tighe
# ─────────────────────────────────────────────────────────────────────────────

## CONTEXT

This completes the original POLARIS_PHONE_FIELD.md spec (migration 025) for
the beta build. Migration 025 already created phone_country_code,
phone_number, and the generated phone_full column. This work does NOT
touch those — it's additive, and delivers the four items Captain Mike
specifically called out as outstanding:

  1. Automatic country code selection         -> resolvePhoneCountryDefault.ts
  2. Intelligent defaults from available data  -> 4-tier priority chain below
  3. Validation                                -> validatePhoneNumber.ts
  4. User override capability                  -> built into PhoneNumberField.tsx

## PRIORITY CHAIN (replaces the old "UAE always defaults" rule)

The original spec hardcoded UAE as the default for vessel/org users. This
generalises that into a real priority chain so it's correct for ANY
vessel/org location, not just UAE-based ones, while still producing UAE
as the practical outcome for JLS's own users since JLS's vessels and
office are UAE-based.

  1. Last used        - this crew member (or guest) previously selected
                         a country code; respect it
  2. Nationality       - crew member's nationality maps to a dial code
  3. Vessel location   - the vessel's home port country (this is the
                         generalised form of "UAE defaults for vessel users")
  4. Org location      - the organisation's primary location country
                         (generalised form of "UAE defaults for org users")
  5. None              - placeholder shown, user picks manually

Note: nationality is checked BEFORE vessel/org location. This is a
deliberate change from the original UAE-only rule. Flag to Mike if he
wants vessel/org location checked first instead — it's a one-line
reorder in resolvePhoneCountryDefault.ts.


## FILES

  schema/migrations/055_phone_intelligent_default.sql
    -> Applied. Run after confirming migration 025 already exists (this
       migration checks for it and fails loudly if not).

  src/lib/phone/resolvePhoneCountryDefault.ts   -> READ-ONLY resolver
  src/lib/phone/persistPhoneSelection.ts         -> WRITE-ONLY save path
  src/lib/phone/validatePhoneNumber.ts           -> Pure validation + formatting, no DB calls

  src/routes/api.phone.resolve-default.ts  -> GET  /api/phone/resolve-default
  src/routes/api.phone.save.ts             -> POST /api/phone/save
  (register both in src/worker-entry.ts — same pattern as native-language routes)

  src/components/visa/PhoneNumberField.tsx
    NOTE: spec originally suggested src/components/shared/ — placed under
    visa/ for now alongside the other visa components. Move to shared/ when
    wiring into Add Crew Member wizard or Emergency Contact form, since the
    component itself has no visa-specific logic.


## INSTALL STEPS

### 1. Confirm migration 025 status

  select column_name from information_schema.columns
  where table_name = 'crew_members' and column_name = 'phone_country_code';

  If this returns nothing, migration 025 was never applied - apply it
  first. Migration 055 will refuse to run otherwise.

### 2. Migration 055 — already applied to production Supabase.

  Verify:
    select count(*) from country_dial_codes;  -- should be 25
    select * from country_dial_codes where country_code = 'AE';
    -- confirm dial_code = '+971', local_format_regex = '^5[0-9]{8}$'

### 3. Place remaining library + API files per the paths above.

### 4. Register API routes in src/worker-entry.ts:

  import { phoneResolveDefaultHandler } from './routes/api.phone.resolve-default'
  import { phoneSaveHandler } from './routes/api.phone.save'

  // inside the fetch handler:
  if (url.pathname === '/api/phone/resolve-default' && request.method === 'GET') {
    return phoneResolveDefaultHandler(request)
  }
  if (url.pathname === '/api/phone/save' && request.method === 'POST') {
    return phoneSaveHandler(request)
  }


## WIRING - EXAMPLE: ADD CREW MEMBER WIZARD

  import { useRef } from 'react';
  import { PhoneNumberField, PhoneNumberFieldHandle } from '@/components/visa/PhoneNumberField';

  function CrewMemberForm({ crewMember, vessel, organisation }) {
    const phoneRef = useRef<PhoneNumberFieldHandle>(null);

    async function handleSubmit() {
      const phoneResult = await phoneRef.current?.save();
      if (!phoneResult?.success) {
        // Surface phoneResult.error to the user - block submit
        return;
      }
      // ... continue with the rest of the form save ...
    }

    return (
      <form onSubmit={handleSubmit}>
        <PhoneNumberField
          ref={phoneRef}
          crewMemberId={crewMember.id}
          nationalityCountry={crewMember.nationality}
          vesselLocationCountry={vessel?.homePortCountry}
          orgLocationCountry={organisation?.locationCountry}
          existingCountryCode={crewMember.phoneCountryIsoCode}
          existingLocalNumber={crewMember.phoneNumber}
          isAuthenticated={!!currentUser}
          required
        />
      </form>
    );
  }

KEY POINT - same pattern as the native language feature: pass
existingCountryCode / existingLocalNumber whenever the crew record
already has a saved phone number. The component skips resolution entirely
in that case and just renders the saved value, guaranteeing a manual
selection is never silently replaced.

NOTE on crewMember.phoneCountryIsoCode: the database stores the dial
code (e.g. '+971') in phone_country_code per migration 025's original
column design, not the ISO alpha-2 code. You'll need a small lookup join
when loading an existing crew record to get the ISO code the component
expects:

  const { data: countryRow } = await supabase
    .from('country_dial_codes')
    .select('country_code')
    .eq('dial_code', crewMember.phone_country_code)
    .maybeSingle();

  // pass countryRow?.country_code as existingCountryCode


## VALIDATION RULES - CURRENTLY SEEDED

  AE  +971  9 digits, must start with 5   (^5[0-9]{8}$)
  GB  +44   10 digits, must start with 7  (^7[0-9]{9}$)
  US  +1    10 digits, no format restriction
  PH  +63   10 digits, must start with 9  (^9[0-9]{9}$)
  IN  +91   10 digits, must start with 6-9
  SA  +966  9 digits, must start with 5
  ... (25 total - see migration for full list)

Editable without a deploy:

  update country_dial_codes
  set min_length = 9, max_length = 9, local_format_regex = '^5[0-9]{8}$'
  where country_code = 'AE';

  -- Add a new country
  insert into country_dial_codes (country_code, dial_code, flag_emoji, country_name, min_length, max_length, is_popular)
  values ('MY', '+60', '🇲🇾', 'Malaysia', 9, 10, false);


## ANALYTICS

Same pattern as native language. Debug a specific record:

  select * from phone_country_selection_log
  where crew_member_id = '<uuid>'
  order by created_at desc;

Measure tier usage:

  select resolved_source, count(*)
  from phone_country_selection_log
  group by 1 order by 2 desc;

Measure override rate per tier:

  select
    resolved_source,
    count(*) as total,
    sum(case when was_overridden then 1 else 0 end) as overridden,
    round(100.0 * sum(case when was_overridden then 1 else 0 end) / count(*), 1) as override_pct
  from phone_country_selection_log
  where resolved_source != 'manual_override'
  group by 1;


## TESTING CHECKLIST

  [ ] Fresh crew record, Filipino nationality, no last-used ->
      field pre-selects PH (+63), badge "From nationality - Philippines"
  [ ] Fresh crew record, crew member previously saved GB number on a
      different form -> field pre-selects GB, badge "Last used"
  [ ] Fresh crew record, no nationality set, vessel home port = AE ->
      field pre-selects AE, badge "Vessel location"
  [ ] Fresh crew record, no nationality, no vessel, org location = AE ->
      field pre-selects AE, badge "Office location"
  [ ] Fresh crew record with none of the above -> placeholder, no badge,
      Popular countries shown
  [ ] Type a 5-digit UAE number -> validation error shown, save blocked
  [ ] Type "501234567" (9 digits, starts with 5) for AE -> valid
  [ ] Type "601234567" (starts with 6, not 5) for AE -> regex validation
      error shown
  [ ] Override the suggested country (e.g. change from PH to GB) -> badge
      disappears immediately, validation re-runs against GB's rules
  [ ] Save -> reload the same crew record -> saved value displays exactly
      as saved, no re-resolution, no badge
  [ ] Search "switz" in country dropdown -> Switzerland appears (if seeded)
  [ ] Full international number preview updates live as user types
  [ ] Guest user (unauthenticated visa application flow) selects a country
      -> preference persists via cookie across page reload
  [ ] No native <select> popup anywhere - confirm fully themed dark UI,
      consistent with VisaOccupationSelect and NativeLanguageSelect


## ROLLBACK

Additive only, same as the native language migration. Safe to leave
schema in place even if rolled back - just revert to rendering the old
plain phone field component.
