/**
 * GET /api/crew/search?name=...&dob=...
 *
 * Global crew search across full_name, first_name, last_name, date_of_birth.
 * DOB is optional — name alone is sufficient.
 * Uses supabaseAdmin to bypass RLS (search is global within user's access scope).
 * POLARIS-SEARCH-005
 */
import { createClient } from '@supabase/supabase-js'
import { parseSearchDOB } from '@/lib/parseSearchDOB'
import { searchLogger } from '@/lib/searchLogger'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getToken(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

export async function crewSearchHandler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const token = getToken(request)
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  const url    = new URL(request.url)
  const rawName = url.searchParams.get('name') ?? ''
  const rawDob  = url.searchParams.get('dob')  ?? ''
  const start  = Date.now()

  const searchText = rawName.trim()
  const dob        = parseSearchDOB(rawDob)

  if (!searchText && !dob) {
    return json({ error: 'Provide a name or date of birth.' }, 400)
  }

  // Build OR filter across name columns and DOB
  const orParts: string[] = []

  if (searchText) {
    // Escape % and _ to prevent them acting as LIKE wildcards in the input
    const safe = searchText.replace(/[%_]/g, (c) => `\\${c}`)

    // Full text against full_name (covers "Michael Jude Fetton" → full_name match)
    orParts.push(`full_name.ilike.%${safe}%`)

    const words = safe.split(/\s+/).filter(Boolean)
    if (words.length === 1) {
      // Single word: search first and last name separately
      orParts.push(`first_name.ilike.%${words[0]}%`)
      orParts.push(`last_name.ilike.%${words[0]}%`)
    } else {
      // Multiple words: first word → first_name, last word → last_name
      // Handles "Michael Fetton" finding "Michael Jude Fetton" via last_name match
      orParts.push(`first_name.ilike.%${words[0]}%`)
      orParts.push(`last_name.ilike.%${words[words.length - 1]}%`)
    }
  }

  if (dob) {
    orParts.push(`date_of_birth.eq.${dob}`)
  }

  let results: any[] = []
  let queryError: string | null = null

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('crew_members')
      .select('id, full_name, first_name, middle_name, last_name, date_of_birth, rank, email, phone_full, nationality, multiple_passports, yacht_id')
      .or(orParts.join(','))
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(20)

    if (error) throw error
    results = data ?? []
  } catch (err: any) {
    queryError = err.message ?? 'Unknown error'
  }

  // Relevance scoring in JS — highest first
  if (results.length > 1 && searchText) {
    const lower = searchText.toLowerCase()
    results.sort((a, b) => score(b, lower, dob) - score(a, lower, dob))
  }

  searchLogger.log({
    userId:      userData.user.id,
    rawInput:    { name: rawName, dob: rawDob },
    parsed:      { searchText, dob },
    resultCount: results.length,
    durationMs:  Date.now() - start,
    error:       queryError,
    zeroResult:  results.length === 0 && !queryError,
  })

  if (queryError) {
    return json({ results: [], error: 'Search failed. Please try again.' }, 500)
  }

  return json({ results })
}

function score(row: any, term: string, dob: string | null): number {
  let s = 0
  const fullName  = (row.full_name  ?? '').toLowerCase().trim()
  const firstName = (row.first_name ?? '').toLowerCase().trim()
  const lastName  = (row.last_name  ?? '').toLowerCase().trim()

  if (fullName === term)              s += 100
  if (lastName === term)             s += 80
  if (firstName === term)            s += 60
  if (dob && row.date_of_birth === dob) s += 40
  if (fullName.includes(term))       s += 20
  if (lastName.includes(term.split(' ').at(-1) ?? term)) s += 10

  return s
}
