# POLARIS — INTELLIGENT NATIVE LANGUAGE DEFAULT
# Migration: 054 · Ticket: assign next (#197 suggested)
# Author: Captain Mike — JLS Yachts LLC
# Developer: Matt Tighe
# ─────────────────────────────────────────────────────────────────────────────

## WHAT THIS DELIVERS

Pre-populates the Native Language field on the Visa Application form using
a four-tier priority chain, fully respecting prior manual selections and
never silently overwriting a saved value.

  1. Passport-derived   (issuing country → primary language, from passport OCR)
  2. Last used           (user profile or guest cookie)
  3. Nationality-derived (configurable country_language_map table)
  4. None                (placeholder + Popular Languages shown)


## FILES

  migrations/054_native_language_intelligent_default.sql
    → run first. Creates languages, country_language_map, guest prefs,
      selection log, and extends user_profiles.

  lib/resolveNativeLanguageDefault.ts
    → READ-ONLY resolver. Implements the 4-tier chain. Never writes.

  lib/persistNativeLanguageSelection.ts
    → WRITE-ONLY persistence. Called only on explicit form save.
      This separation (read vs write) is the mechanism that prevents
      accidental overwrites — the resolver is never given write access.

  lib/guestToken.ts
    → Client-side cookie helper for unauthenticated users.

  api/resolve-default.ts  →  src/app/api/native-language/resolve-default/route.ts
  api/save.ts              →  src/app/api/native-language/save/route.ts

  components/NativeLanguageSelect.tsx
    → Themed, searchable dropdown. Pure UI — receives resolved data as props.

  components/NativeLanguageField.tsx
    → Container component. Wires resolution + UI + save together.
      THIS is what you drop into the visa application form.


## INSTALL STEPS

### 1. Run the migration

  Apply migrations/054_native_language_intelligent_default.sql via Supabase.
  ALREADY APPLIED to jls-yachts-crm — skip this step.

  Verify afterward:
    select * from languages order by is_popular desc, sort_order;
    select country_code, count(*) from country_language_map
      where is_primary group by 1 having count(*) > 1;
    -- ↳ must return ZERO rows (confirms one-primary-per-country constraint)

### 2. Library files — already in repo

  src/lib/native-language/resolveNativeLanguageDefault.ts
  src/lib/native-language/persistNativeLanguageSelection.ts
  src/lib/native-language/guestToken.ts

### 3. API routes

  Wire these two route handlers into src/worker-entry.ts
  (Polaris uses Cloudflare Workers + TanStack Router, not Next.js App Router):

  src/routes/api.native-language.resolve-default.ts  →  GET  /api/native-language/resolve-default
  src/routes/api.native-language.save.ts              →  POST /api/native-language/save

### 4. Components — already in repo

  src/components/visa/NativeLanguageSelect.tsx
  src/components/visa/NativeLanguageField.tsx


## WIRING INTO THE VISA APPLICATION FORM

  import { useRef } from 'react';
  import { NativeLanguageField, NativeLanguageFieldHandle } from '@/components/visa/NativeLanguageField';

  function VisaApplicationForm({ application }) {
    const nativeLanguageRef = useRef<NativeLanguageFieldHandle>(null);

    async function handleSubmit() {
      // ... validate other fields ...

      // Persist the native language selection (fire this BEFORE or alongside
      // the main application save — order doesn't matter, they're independent)
      await nativeLanguageRef.current?.save();

      // ... save the rest of the application as normal ...
    }

    return (
      <form onSubmit={handleSubmit}>
        {/* ... other fields ... */}

        <NativeLanguageField
          ref={nativeLanguageRef}
          applicationId={application.id}
          passportCountry={application.passport?.issuingCountry}
          nationalityCountry={application.nationality}
          existingValue={application.nativeLanguage}   // null for a fresh application
          isAuthenticated={!!currentUser}
          required
        />

        {/* ... submit button ... */}
      </form>
    );
  }

  KEY POINT: pass `existingValue={application.nativeLanguage}`. If the
  application already has a saved value, the field skips resolution
  entirely and just shows the saved value — this is what guarantees a
  user's manual selection is never silently replaced on a later form load.


## ADMIN-EDITABLE MAPPING (no-deploy requirement)

The country_language_map table is the single source of truth and requires
no code changes to update. To add or change a mapping:

  -- Add a new country mapping
  insert into country_language_map (country_code, language_code, is_primary)
  values ('MY', 'ms', true);   -- assumes 'ms' (Malay) already exists in languages

  -- Change which language is primary for a multi-language country
  update country_language_map set is_primary = false where country_code = 'CH' and language_code = 'de';
  update country_language_map set is_primary = true  where country_code = 'CH' and language_code = 'fr';

  -- Add a new language to the canonical list first, if it doesn't exist
  insert into languages (code, name, native_name, is_popular)
  values ('ms', 'Malay', 'Bahasa Melayu', false);

RECOMMENDATION: build a small admin sub-page under /dashboard/admin for this
once the core feature is verified working — out of scope for this ticket,
but flagging it now since "configurable without deployment" implies a UI
eventually, not just direct SQL access. For now, Mike or Astrid can run the
SQL directly via Supabase Studio.


## ANALYTICS — ANSWERING "WHY DID THIS DEFAULT TO X?"

Every resolution and every save is logged to native_language_selection_log.
To debug a specific user's experience:

  select * from native_language_selection_log
  where application_id = '<uuid>'
  order by created_at desc;

To measure how often each tier actually fires (useful before/after the
admin mapping table is extended):

  select resolved_source, count(*)
  from native_language_selection_log
  group by 1
  order by 2 desc;

To measure override rate (how often users reject the suggestion):

  select
    resolved_source,
    count(*) as total,
    sum(case when was_overridden then 1 else 0 end) as overridden,
    round(100.0 * sum(case when was_overridden then 1 else 0 end) / count(*), 1) as override_pct
  from native_language_selection_log
  where resolved_source != 'manual_override'
  group by 1;


## TESTING CHECKLIST

  [ ] Fresh application, passport uploaded with Philippines issuing country
      → field pre-selects Tagalog, badge shows "From passport"
  [ ] Fresh application, no passport, authenticated user who previously
      selected French on another application → field pre-selects French,
      badge shows "Last used"
  [ ] Fresh application, no passport, guest user with a cookie from a
      prior visit selecting Russian → field pre-selects Russian, badge
      shows "Last used"
  [ ] Fresh application, no passport, no last-used, nationality = Switzerland
      → field pre-selects German (the configured primary for CH)
  [ ] Fresh application with none of the above → placeholder shown,
      Popular Languages section visible, no badge
  [ ] User overrides a passport-suggested default → badge disappears
      immediately on change (isUnmodifiedDefault goes false)
  [ ] Save the form → reload the same application → saved value displays
      exactly as saved, resolution is NOT re-run, no badge (since existingValue
      bypasses the suggestion flow entirely)
  [ ] Switzerland/Belgium/Canada — confirm exactly one primary language
      per country is returned, never an error from multiple primaries
  [ ] Search "Tag" in the dropdown → Tagalog appears in Popular section,
      no duplicate entry in A-Z section
  [ ] Guest user signs up after selecting a language → run
      migrateGuestLanguagePref() in the signup flow → confirm their
      preference carried over to user_profiles and the guest row was deleted
  [ ] Dropdown renders correctly with no native browser <select> popup
      involved — full dark theme, no white OS popup, no readability issue


## ROLLBACK

If this needs to be rolled back, the migration is additive only — no
existing columns were altered destructively, only new ones added. Safe to
leave the schema in place even if the feature is disabled; just stop
rendering NativeLanguageField and revert to the prior implementation.
