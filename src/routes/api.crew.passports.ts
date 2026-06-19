/**
 * Crew Passport API
 *
 * GET    /api/crew/:crewId/passports           — list passports with is_expired computed
 * POST   /api/crew/:crewId/passports           — add passport (limit + primary logic)
 * DELETE /api/crew/:crewId/passports/:passportId — remove, auto-promote primary
 *
 * Auth: Bearer token in Authorization header → supabaseAdmin.auth.getUser(token)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

async function authenticate(request: Request) {
  const token = getToken(request)
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

/** Compute is_expired server-side from expiry_date */
function withExpired(p: Record<string, unknown>) {
  const expiry = p.expiry_date as string | null
  return {
    ...p,
    is_expired: expiry ? new Date(expiry) < new Date() : false,
  }
}

// ── GET /api/crew/:crewId/passports ──────────────────────────────────────────

async function handleList(crewId: string, request: Request): Promise<Response> {
  const user = await authenticate(request)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { data, error } = await (supabaseAdmin as any)
    .from('crew_passports')
    .select('*')
    .eq('crew_id', crewId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return json({ error: error.message }, 500)

  return json({ passports: (data ?? []).map(withExpired) })
}

// ── POST /api/crew/:crewId/passports ─────────────────────────────────────────

async function handleAdd(crewId: string, request: Request): Promise<Response> {
  const user = await authenticate(request)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let body: {
    country_of_issue:  string
    passport_number:   string
    nationality:       string
    issue_date:        string
    expiry_date:       string
    is_primary?:       boolean
  }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { country_of_issue, passport_number, nationality, issue_date, expiry_date } = body

  if (!country_of_issue || !passport_number || !nationality || !issue_date || !expiry_date) {
    return json({ error: 'All fields are required: country_of_issue, passport_number, nationality, issue_date, expiry_date' }, 400)
  }

  // Server-side: enforce 3-passport limit before insert (DB trigger also catches it)
  const { count } = await (supabaseAdmin as any)
    .from('crew_passports')
    .select('id', { count: 'exact', head: true })
    .eq('crew_id', crewId)

  if ((count ?? 0) >= 3) {
    return json({ error: 'Maximum of 3 passports allowed per crew member.' }, 422)
  }

  // Duplicate check: passport_number must be unique per crew member
  const { data: dup } = await (supabaseAdmin as any)
    .from('crew_passports')
    .select('id')
    .eq('crew_id', crewId)
    .eq('passport_number', passport_number.trim())
    .maybeSingle()

  if (dup) {
    return json({ error: 'This passport number is already on file for this crew member.' }, 409)
  }

  const isFirst = (count ?? 0) === 0
  const isPrimary = isFirst ? true : (body.is_primary ?? false)

  // If setting as primary, demote all existing primaries first
  if (isPrimary && !isFirst) {
    await (supabaseAdmin as any)
      .from('crew_passports')
      .update({ is_primary: false })
      .eq('crew_id', crewId)
  }

  const { data: created, error: insertErr } = await (supabaseAdmin as any)
    .from('crew_passports')
    .insert({
      crew_id:         crewId,
      issuing_country: country_of_issue.trim(),  // existing column name
      passport_number: passport_number.trim(),
      nationality:     nationality.trim(),
      issue_date,
      expiry_date,
      is_primary:      isPrimary,
    })
    .select('*')
    .single()

  if (insertErr) {
    if (insertErr.message?.includes('Maximum of 3')) {
      return json({ error: 'Maximum of 3 passports allowed per crew member.' }, 422)
    }
    if (insertErr.code === '23505') {
      return json({ error: 'This passport number is already on file for this crew member.' }, 409)
    }
    return json({ error: insertErr.message }, 500)
  }

  return json({ passport: withExpired(created) }, 201)
}

// ── DELETE /api/crew/:crewId/passports/:passportId ───────────────────────────

async function handleDelete(crewId: string, passportId: string, request: Request): Promise<Response> {
  const user = await authenticate(request)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  // Fetch the passport being deleted to check if it was primary
  const { data: target, error: fetchErr } = await (supabaseAdmin as any)
    .from('crew_passports')
    .select('id, is_primary, created_at')
    .eq('id', passportId)
    .eq('crew_id', crewId)
    .maybeSingle()

  if (fetchErr || !target) return json({ error: 'Passport not found' }, 404)

  const { error: deleteErr } = await (supabaseAdmin as any)
    .from('crew_passports')
    .delete()
    .eq('id', passportId)
    .eq('crew_id', crewId)

  if (deleteErr) return json({ error: deleteErr.message }, 500)

  // Auto-promote oldest remaining to primary if we just deleted the primary
  if (target.is_primary) {
    const { data: remaining } = await (supabaseAdmin as any)
      .from('crew_passports')
      .select('id')
      .eq('crew_id', crewId)
      .order('created_at', { ascending: true })
      .limit(1)

    if (remaining?.[0]) {
      await (supabaseAdmin as any)
        .from('crew_passports')
        .update({ is_primary: true })
        .eq('id', remaining[0].id)
    }
  }

  // Return updated list
  const { data: updated } = await (supabaseAdmin as any)
    .from('crew_passports')
    .select('*')
    .eq('crew_id', crewId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  return json({ passports: (updated ?? []).map(withExpired) })
}

// ── Router ────────────────────────────────────────────────────────────────────

export async function crewPassportsHandler(request: Request): Promise<Response> {
  const url      = new URL(request.url)
  // Match: /api/crew/{crewId}/passports[/{passportId}]
  const match = url.pathname.match(/^\/api\/crew\/([^/]+)\/passports\/?([^/]*)$/)
  if (!match) return json({ error: 'Not found' }, 404)

  const crewId      = match[1]
  const passportId  = match[2] || null

  if (request.method === 'GET'    && !passportId) return handleList(crewId, request)
  if (request.method === 'POST'   && !passportId) return handleAdd(crewId, request)
  if (request.method === 'DELETE' && passportId)  return handleDelete(crewId, passportId, request)

  return json({ error: 'Not found' }, 404)
}
