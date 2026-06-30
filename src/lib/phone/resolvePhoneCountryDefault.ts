/**
 * resolvePhoneCountryDefault
 *
 * Implements the intelligent default priority chain for the phone number
 * country code selector, completing the original POLARIS_PHONE_FIELD.md
 * spec's "UAE defaults automatically for vessel/org users" requirement
 * with a fuller, data-driven resolution order.
 *
 * Priority order:
 *   1. Last used selection     — this specific user/guest has set a country
 *                                 code before; respect deliberate past choice
 *   2. Nationality-derived      — crew member's nationality maps to a dial code
 *   3. Vessel/org location      — the vessel's home port or organisation's
 *                                 location country (this is what the original
 *                                 "UAE defaults for vessel/org users" rule
 *                                 generalises to — UAE was the special case
 *                                 because JLS's vessels and org are UAE-based,
 *                                 but the general rule is "default to the
 *                                 context's location country")
 *   4. No default               — placeholder shown, user must pick manually
 *
 * Same read-only / write-only separation as the native language resolver:
 * this function NEVER writes. Persistence is a separate, explicit save step.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhoneDefaultSource = 'last_used' | 'nationality' | 'vessel_location' | 'org_location' | 'none';

export interface ResolvedPhoneDefault {
  countryCode: string | null;   // ISO 3166-1 alpha-2, e.g. 'AE'
  dialCode:    string | null;   // e.g. '+971'
  source:      PhoneDefaultSource;
  detail?: {
    nationalityCountry?: string;
    vesselLocationCountry?: string;
    orgLocationCountry?: string;
  };
}

export interface ResolvePhoneInput {
  /** Crew member's nationality, ISO 3166-1 alpha-2 */
  nationalityCountry?: string | null;

  /** The vessel's home port / current location country, if this form is in a vessel context */
  vesselLocationCountry?: string | null;

  /** The organisation's primary location country, if this form is in an org context (no specific vessel) */
  orgLocationCountry?: string | null;

  /** Authenticated user/crew member ID — checked for a prior last-used selection */
  crewMemberId?: string | null;

  /** Guest token — checked if crewMemberId is absent */
  guestToken?: string | null;

  supabase?: SupabaseClient;
}

// ─── Client helper ─────────────────────────────────────────────────────────────

function getClient(existing?: SupabaseClient): SupabaseClient {
  if (existing) return existing;
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

async function lookupDialCode(
  supabase: SupabaseClient,
  countryCode: string,
): Promise<{ countryCode: string; dialCode: string } | null> {
  const { data, error } = await supabase
    .from('country_dial_codes')
    .select('country_code, dial_code')
    .eq('country_code', countryCode.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('[resolvePhoneCountryDefault] dial code lookup failed:', error.message);
    return null;
  }
  if (!data) return null;

  return { countryCode: data.country_code, dialCode: data.dial_code };
}

async function resolveLastUsed(
  supabase: SupabaseClient,
  crewMemberId: string | null,
  guestToken: string | null,
): Promise<string | null> {
  if (crewMemberId) {
    const { data, error } = await supabase
      .from('crew_members')
      .select('phone_country_code, phone_default_source')
      .eq('id', crewMemberId)
      .maybeSingle();

    if (error) {
      console.error('[resolvePhoneCountryDefault] crew last-used lookup failed:', error.message);
      return null;
    }

    // phone_country_code is stored as the dial code (e.g. '+971') per migration 025.
    // We need the ISO country code for downstream lookups, so reverse-map it.
    if (!data?.phone_country_code) return null;

    const { data: countryRow } = await supabase
      .from('country_dial_codes')
      .select('country_code')
      .eq('dial_code', data.phone_country_code)
      .maybeSingle();

    return countryRow?.country_code ?? null;
  }

  if (guestToken) {
    const { data, error } = await supabase
      .from('guest_phone_country_prefs')
      .select('country_code')
      .eq('guest_token', guestToken)
      .maybeSingle();

    if (error) {
      console.error('[resolvePhoneCountryDefault] guest last-used lookup failed:', error.message);
      return null;
    }

    return data?.country_code ?? null;
  }

  return null;
}

// ─── Analytics logging ─────────────────────────────────────────────────────────

interface LogParams {
  crewMemberId?:           string | null;
  guestToken?:             string | null;
  resolvedSource:          PhoneDefaultSource | 'manual_override';
  resolvedCountryCode:     string | null;
  nationalityCountry?:     string | null;
  vesselLocationCountry?:  string | null;
}

export async function logPhoneResolution(
  params: LogParams,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = getClient(supabase);

  const { error } = await client.from('phone_country_selection_log').insert({
    crew_member_id:         params.crewMemberId ?? null,
    guest_token:             params.guestToken ?? null,
    resolved_source:         params.resolvedSource,
    resolved_country_code:   params.resolvedCountryCode,
    nationality_used:        params.nationalityCountry ?? null,
    vessel_location_used:    params.vesselLocationCountry ?? null,
  });

  if (error) {
    console.error('[logPhoneResolution] insert failed:', error.message);
  }
}

// ─── Main resolver ──────────────────────────────────────────────────────────────

export async function resolvePhoneCountryDefault(
  input: ResolvePhoneInput,
): Promise<ResolvedPhoneDefault> {
  const supabase = getClient(input.supabase);

  // ── Tier 1: Last used ─────────────────────────────────────────────────────
  if (input.crewMemberId || input.guestToken) {
    const countryCode = await resolveLastUsed(supabase, input.crewMemberId ?? null, input.guestToken ?? null);
    if (countryCode) {
      const lookup = await lookupDialCode(supabase, countryCode);
      if (lookup) {
        return { countryCode: lookup.countryCode, dialCode: lookup.dialCode, source: 'last_used' };
      }
    }
  }

  // ── Tier 2: Nationality ───────────────────────────────────────────────────
  if (input.nationalityCountry) {
    const lookup = await lookupDialCode(supabase, input.nationalityCountry);
    if (lookup) {
      return {
        countryCode: lookup.countryCode,
        dialCode:    lookup.dialCode,
        source:      'nationality',
        detail:      { nationalityCountry: input.nationalityCountry },
      };
    }
  }

  // ── Tier 3a: Vessel location ───────────────────────────────────────────────
  if (input.vesselLocationCountry) {
    const lookup = await lookupDialCode(supabase, input.vesselLocationCountry);
    if (lookup) {
      return {
        countryCode: lookup.countryCode,
        dialCode:    lookup.dialCode,
        source:      'vessel_location',
        detail:      { vesselLocationCountry: input.vesselLocationCountry },
      };
    }
  }

  // ── Tier 3b: Org location ─────────────────────────────────────────────────
  if (input.orgLocationCountry) {
    const lookup = await lookupDialCode(supabase, input.orgLocationCountry);
    if (lookup) {
      return {
        countryCode: lookup.countryCode,
        dialCode:    lookup.dialCode,
        source:      'org_location',
        detail:      { orgLocationCountry: input.orgLocationCountry },
      };
    }
  }

  // ── Tier 4: No default ────────────────────────────────────────────────────
  return { countryCode: null, dialCode: null, source: 'none' };
}
