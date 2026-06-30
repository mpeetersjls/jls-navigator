/**
 * Phone API
 *
 * Legacy (old phone-input.tsx):
 *   GET  /api/phone/countries       — full ITU country list (cached, static)
 *   GET  /api/phone/default-country — context-aware default for current user
 *   POST /api/phone/validate        — server-side number validation
 *
 * Ticket #198 (PhoneNumberField — DB-backed, country_dial_codes table):
 *   GET  /api/phone/resolve-default — country list + intelligent default
 *   POST /api/phone/save            — persist selection + analytics
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { persistPhoneSelection } from '@/lib/phone/persistPhoneSelection'
import { resolvePhoneCountryDefault, logPhoneResolution } from '@/lib/phone/resolvePhoneCountryDefault'

// ── Country data ─────────────────────────────────────────────────────────────
// UAE is pinned first; remaining entries are alphabetical.

export interface CountryEntry {
  name: string
  iso2: string
  dialCode: string
  flag: string
  format: string     // X = digit placeholder, e.g. "XX XXX XXXX"
  minLength: number
  maxLength: number
}

const COUNTRIES: CountryEntry[] = [
  // ── GCC / Gulf pinned first ───────────────────────────────────────────────
  { name: 'United Arab Emirates', iso2: 'AE', dialCode: '+971', flag: '🇦🇪', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Saudi Arabia',          iso2: 'SA', dialCode: '+966', flag: '🇸🇦', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Bahrain',               iso2: 'BH', dialCode: '+973', flag: '🇧🇭', format: 'XXXX XXXX',   minLength: 8,  maxLength: 8  },
  { name: 'Kuwait',                iso2: 'KW', dialCode: '+965', flag: '🇰🇼', format: 'XXXX XXXX',   minLength: 8,  maxLength: 8  },
  { name: 'Oman',                  iso2: 'OM', dialCode: '+968', flag: '🇴🇲', format: 'XXXX XXXX',   minLength: 8,  maxLength: 8  },
  { name: 'Qatar',                 iso2: 'QA', dialCode: '+974', flag: '🇶🇦', format: 'XXXX XXXX',   minLength: 8,  maxLength: 8  },
  // ── Alphabetical ─────────────────────────────────────────────────────────
  { name: 'Argentina',             iso2: 'AR', dialCode: '+54',  flag: '🇦🇷', format: 'XX XXXX XXXX', minLength: 10, maxLength: 11 },
  { name: 'Australia',             iso2: 'AU', dialCode: '+61',  flag: '🇦🇺', format: 'XXX XXX XXX',  minLength: 9,  maxLength: 9  },
  { name: 'Belgium',               iso2: 'BE', dialCode: '+32',  flag: '🇧🇪', format: 'XXX XX XX XX', minLength: 9,  maxLength: 9  },
  { name: 'Brazil',                iso2: 'BR', dialCode: '+55',  flag: '🇧🇷', format: 'XX XXXXX XXXX',minLength: 10, maxLength: 11 },
  { name: 'Canada',                iso2: 'CA', dialCode: '+1',   flag: '🇨🇦', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'China',                 iso2: 'CN', dialCode: '+86',  flag: '🇨🇳', format: 'XXX XXXX XXXX',minLength: 11, maxLength: 11 },
  { name: 'Croatia',               iso2: 'HR', dialCode: '+385', flag: '🇭🇷', format: 'XX XXX XXXX',  minLength: 8,  maxLength: 9  },
  { name: 'Denmark',               iso2: 'DK', dialCode: '+45',  flag: '🇩🇰', format: 'XXXX XXXX',   minLength: 8,  maxLength: 8  },
  { name: 'Egypt',                 iso2: 'EG', dialCode: '+20',  flag: '🇪🇬', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'Finland',               iso2: 'FI', dialCode: '+358', flag: '🇫🇮', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 10 },
  { name: 'France',                iso2: 'FR', dialCode: '+33',  flag: '🇫🇷', format: 'X XX XX XX XX', minLength: 9, maxLength: 9  },
  { name: 'Germany',               iso2: 'DE', dialCode: '+49',  flag: '🇩🇪', format: 'XXX XXXXXXX',  minLength: 10, maxLength: 12 },
  { name: 'Greece',                iso2: 'GR', dialCode: '+30',  flag: '🇬🇷', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'India',                 iso2: 'IN', dialCode: '+91',  flag: '🇮🇳', format: 'XXXXX XXXXX',  minLength: 10, maxLength: 10 },
  { name: 'Indonesia',             iso2: 'ID', dialCode: '+62',  flag: '🇮🇩', format: 'XXX XXXX XXXX',minLength: 9,  maxLength: 12 },
  { name: 'Ireland',               iso2: 'IE', dialCode: '+353', flag: '🇮🇪', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Italy',                 iso2: 'IT', dialCode: '+39',  flag: '🇮🇹', format: 'XXX XXX XXXX', minLength: 9,  maxLength: 11 },
  { name: 'Japan',                 iso2: 'JP', dialCode: '+81',  flag: '🇯🇵', format: 'XX XXXX XXXX', minLength: 10, maxLength: 11 },
  { name: 'Jordan',                iso2: 'JO', dialCode: '+962', flag: '🇯🇴', format: 'X XXXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Kenya',                 iso2: 'KE', dialCode: '+254', flag: '🇰🇪', format: 'XXX XXX XXX',  minLength: 9,  maxLength: 9  },
  { name: 'Lebanon',               iso2: 'LB', dialCode: '+961', flag: '🇱🇧', format: 'XX XXX XXX',   minLength: 7,  maxLength: 8  },
  { name: 'Malaysia',              iso2: 'MY', dialCode: '+60',  flag: '🇲🇾', format: 'XX XXXX XXXX', minLength: 9,  maxLength: 10 },
  { name: 'Maldives',              iso2: 'MV', dialCode: '+960', flag: '🇲🇻', format: 'XXX XXXX',     minLength: 7,  maxLength: 7  },
  { name: 'Malta',                 iso2: 'MT', dialCode: '+356', flag: '🇲🇹', format: 'XXXX XXXX',    minLength: 8,  maxLength: 8  },
  { name: 'Mexico',                iso2: 'MX', dialCode: '+52',  flag: '🇲🇽', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'Monaco',                iso2: 'MC', dialCode: '+377', flag: '🇲🇨', format: 'XXXX XXXX',    minLength: 8,  maxLength: 9  },
  { name: 'Netherlands',           iso2: 'NL', dialCode: '+31',  flag: '🇳🇱', format: 'X XX XX XX XX', minLength: 9, maxLength: 9  },
  { name: 'New Zealand',           iso2: 'NZ', dialCode: '+64',  flag: '🇳🇿', format: 'XX XXX XXXX',  minLength: 8,  maxLength: 9  },
  { name: 'Nigeria',               iso2: 'NG', dialCode: '+234', flag: '🇳🇬', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'Norway',                iso2: 'NO', dialCode: '+47',  flag: '🇳🇴', format: 'XXX XX XXX',   minLength: 8,  maxLength: 8  },
  { name: 'Philippines',           iso2: 'PH', dialCode: '+63',  flag: '🇵🇭', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'Poland',                iso2: 'PL', dialCode: '+48',  flag: '🇵🇱', format: 'XXX XXX XXX',  minLength: 9,  maxLength: 9  },
  { name: 'Portugal',              iso2: 'PT', dialCode: '+351', flag: '🇵🇹', format: 'XXX XXX XXX',  minLength: 9,  maxLength: 9  },
  { name: 'Romania',               iso2: 'RO', dialCode: '+40',  flag: '🇷🇴', format: 'XXX XXX XXX',  minLength: 9,  maxLength: 9  },
  { name: 'Singapore',             iso2: 'SG', dialCode: '+65',  flag: '🇸🇬', format: 'XXXX XXXX',    minLength: 8,  maxLength: 8  },
  { name: 'South Africa',          iso2: 'ZA', dialCode: '+27',  flag: '🇿🇦', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Spain',                 iso2: 'ES', dialCode: '+34',  flag: '🇪🇸', format: 'XXX XXX XXX',  minLength: 9,  maxLength: 9  },
  { name: 'Sri Lanka',             iso2: 'LK', dialCode: '+94',  flag: '🇱🇰', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Sweden',                iso2: 'SE', dialCode: '+46',  flag: '🇸🇪', format: 'XX XXX XX XX', minLength: 9,  maxLength: 9  },
  { name: 'Switzerland',           iso2: 'CH', dialCode: '+41',  flag: '🇨🇭', format: 'XX XXX XX XX', minLength: 9,  maxLength: 9  },
  { name: 'Thailand',              iso2: 'TH', dialCode: '+66',  flag: '🇹🇭', format: 'X XXXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'Turkey',                iso2: 'TR', dialCode: '+90',  flag: '🇹🇷', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
  { name: 'Ukraine',               iso2: 'UA', dialCode: '+380', flag: '🇺🇦', format: 'XX XXX XXXX',  minLength: 9,  maxLength: 9  },
  { name: 'United Kingdom',        iso2: 'GB', dialCode: '+44',  flag: '🇬🇧', format: 'XXXX XXXXXX',  minLength: 10, maxLength: 10 },
  { name: 'United States',         iso2: 'US', dialCode: '+1',   flag: '🇺🇸', format: 'XXX XXX XXXX', minLength: 10, maxLength: 10 },
]

const GCC_ISO2 = new Set(['AE', 'SA', 'BH', 'KW', 'OM', 'QA'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lookupByDialCode(dialCode: string): CountryEntry | undefined {
  return COUNTRIES.find((c) => c.dialCode === dialCode)
}

// ── GET /api/phone/countries ──────────────────────────────────────────────────

function handleCountries(): Response {
  return new Response(JSON.stringify({ countries: COUNTRIES }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

// ── GET /api/phone/default-country ───────────────────────────────────────────

function handleDefaultCountry(): Response {
  // System default is always UAE (GCC-first product).
  // In future this can be made org/vessel-aware via DB lookup.
  const ae = COUNTRIES[0] // UAE is always index 0
  return json({ iso2: ae.iso2, dialCode: ae.dialCode, flag: ae.flag, name: ae.name })
}

// ── POST /api/phone/validate ──────────────────────────────────────────────────

async function handleValidate(request: Request): Promise<Response> {
  let body: { country_code: string; phone_number: string }
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const { country_code, phone_number } = body
  if (!country_code || phone_number === undefined) {
    return json({ error: 'country_code and phone_number are required' }, 400)
  }

  const digits = phone_number.replace(/\D/g, '')
  const country = lookupByDialCode(country_code)

  if (!country) {
    // Unknown country code — accept but skip length validation
    return json({
      valid: true,
      formatted: `${country_code} ${phone_number}`,
      full: `${country_code}${digits}`,
    })
  }

  if (digits.length < country.minLength || digits.length > country.maxLength) {
    const range = country.minLength === country.maxLength
      ? `${country.minLength}`
      : `${country.minLength}–${country.maxLength}`
    return json({
      valid: false,
      error: `${country.name} numbers must be ${range} digits. You entered ${digits.length}.`,
    })
  }

  const formatted = applyFormat(digits, country.format)
  return json({
    valid: true,
    formatted: `${country.dialCode} ${formatted}`,
    full: `${country.dialCode}${digits}`,
  })
}

/** Apply an X-based format pattern to a digit string (display only). */
function applyFormat(digits: string, format: string): string {
  let i = 0
  return format.replace(/X/g, () => digits[i++] ?? '').trimEnd()
}

// ── Ticket #198: DB-backed resolve-default + save (country_dial_codes table) ──

function admin(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
  )
}

interface DialCodeRow {
  country_code: string; dial_code: string; flag_emoji: string | null; country_name: string
  min_length: number; max_length: number; local_format_regex: string | null
  is_popular: boolean; sort_order: number | null
}

function toDialOption(r: DialCodeRow) {
  return {
    countryCode: r.country_code, dialCode: r.dial_code, flagEmoji: r.flag_emoji,
    countryName: r.country_name, minLength: r.min_length, maxLength: r.max_length,
    localFormatRegex: r.local_format_regex, isPopular: r.is_popular, sortOrder: r.sort_order ?? 0,
  }
}

async function loadDialCodes(sb: SupabaseClient): Promise<DialCodeRow[]> {
  const { data, error } = await sb
    .from('country_dial_codes')
    .select('country_code, dial_code, flag_emoji, country_name, min_length, max_length, local_format_regex, is_popular, sort_order')
    .order('is_popular', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('country_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as DialCodeRow[]
}

// GET /api/phone/resolve-default — country list + intelligent default.
// Resolution delegates to the canonical resolvePhoneCountryDefault; the country
// list is mapped to the camelCase shape PhoneNumberField expects.
async function handleResolveDefault(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const nationalityCountry    = url.searchParams.get('nationalityCountry')
  const vesselLocationCountry = url.searchParams.get('vesselLocationCountry')
  const orgLocationCountry    = url.searchParams.get('orgLocationCountry')
  const crewMemberId          = url.searchParams.get('crewMemberId')
  const guestToken            = request.headers.get('X-Guest-Token')

  const sb = admin()
  try {
    const resolved = await resolvePhoneCountryDefault({
      nationalityCountry,
      vesselLocationCountry,
      orgLocationCountry,
      crewMemberId,
      guestToken: crewMemberId ? null : guestToken,
      supabase: sb,
    })

    let countries
    try { countries = (await loadDialCodes(sb)).map(toDialOption) }
    catch (e: any) { return json({ error: 'Failed to load country list', detail: e?.message }, 500) }

    logPhoneResolution(
      {
        crewMemberId,
        guestToken: crewMemberId ? null : guestToken,
        resolvedSource:        resolved.source,
        resolvedCountryCode:   resolved.countryCode,
        nationalityCountry:    resolved.detail?.nationalityCountry ?? null,
        vesselLocationCountry: resolved.detail?.vesselLocationCountry ?? null,
      },
      sb,
    ).catch((e) => console.error('[resolve-default] log failed silently:', e))

    return json({
      defaultCountryCode: resolved.countryCode,
      defaultDialCode:    resolved.dialCode,
      defaultSource:      resolved.source,
      countries,
    })
  } catch (err: any) {
    console.error('[GET /api/phone/resolve-default] unexpected error:', err)
    return json({ error: 'Unexpected error resolving phone country default' }, 500)
  }
}

// POST /api/phone/save — server-authoritative validate + persist + log.
async function handleSave(request: Request): Promise<Response> {
  let body: any
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const {
    finalCountryCode, finalLocalNumber, suggestedCountryCode, suggestedSource,
    crewMemberId, nationalityCountry, vesselLocationCountry,
  } = body ?? {}

  if (!finalCountryCode || typeof finalCountryCode !== 'string') {
    return json({ error: 'finalCountryCode is required' }, 400)
  }
  if (!finalLocalNumber || typeof finalLocalNumber !== 'string') {
    return json({ error: 'finalLocalNumber is required' }, 400)
  }

  const guestToken = request.headers.get('X-Guest-Token')
  if (!crewMemberId && !guestToken) {
    return json({ error: 'No crewMemberId and no guest token present — cannot persist selection' }, 400)
  }

  const sb = admin()
  const { data: rule, error: ruleError } = await sb.from('country_dial_codes')
    .select('country_code, dial_code, min_length, max_length, local_format_regex')
    .eq('country_code', finalCountryCode.toUpperCase()).maybeSingle()

  if (ruleError || !rule) {
    return json({ error: `Unknown country code: ${finalCountryCode}` }, 400)
  }

  try {
    const result = await persistPhoneSelection({
      finalCountryCode,
      finalLocalNumber,
      suggestedCountryCode:  suggestedCountryCode ?? null,
      suggestedSource:       suggestedSource ?? null,
      crewMemberId:          crewMemberId ?? null,
      guestToken:            crewMemberId ? null : guestToken,
      nationalityCountry:    nationalityCountry ?? null,
      vesselLocationCountry: vesselLocationCountry ?? null,
      validationRule: {
        countryCode:      (rule as any).country_code,
        dialCode:         (rule as any).dial_code,
        minLength:        (rule as any).min_length,
        maxLength:        (rule as any).max_length,
        localFormatRegex: (rule as any).local_format_regex,
      },
      supabase: sb,
    })

    if (!result.success) {
      return json(
        {
          error: result.validationError ? 'Validation failed' : 'Failed to persist selection',
          detail: result.validationError ?? result.error,
        },
        result.validationPassed === false ? 422 : 500,
      )
    }

    return json({ success: true, wasOverridden: result.wasOverridden })
  } catch (err: any) {
    console.error('[POST /api/phone/save] unexpected error:', err)
    return json({ error: 'Unexpected error saving phone selection' }, 500)
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function phoneHandler(request: Request): Promise<Response> {
  const url  = new URL(request.url)
  const sub  = url.pathname.replace('/api/phone', '').replace(/\/$/, '')

  if (sub === '/countries'       && request.method === 'GET')  return handleCountries()
  if (sub === '/default-country' && request.method === 'GET')  return handleDefaultCountry()
  if (sub === '/validate'        && request.method === 'POST') return handleValidate(request)
  if (sub === '/resolve-default' && request.method === 'GET')  return handleResolveDefault(request)
  if (sub === '/save'            && request.method === 'POST') return handleSave(request)

  return json({ error: 'Not found' }, 404)
}

// ── Exported country list for front-end static import ────────────────────────
export { COUNTRIES }
