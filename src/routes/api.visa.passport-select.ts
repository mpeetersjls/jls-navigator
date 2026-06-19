/**
 * PATCH /api/visa/:applicationId/passport
 *
 * Sets the selected passport on an active visa application.
 * Validates the passport belongs to the correct crew member.
 * Only allows selection changes when the application is in a mutable state.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MUTABLE_STATUSES = ['draft', 'pending_docs']

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

export async function visaPassportSelectHandler(request: Request): Promise<Response> {
  if (request.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405)

  const token = getToken(request)
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  // Extract applicationId from URL: /api/visa/:applicationId/passport
  const url   = new URL(request.url)
  const match = url.pathname.match(/^\/api\/visa\/([^/]+)\/passport$/)
  if (!match) return json({ error: 'Not found' }, 404)
  const applicationId = match[1]

  let body: { passport_id: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.passport_id) return json({ error: 'passport_id is required' }, 400)

  // Fetch the application to verify state and crew member
  const { data: application, error: appErr } = await (supabaseAdmin as any)
    .from('visa_applications')
    .select('id, crew_member_id, status')
    .eq('id', applicationId)
    .maybeSingle()

  if (appErr || !application) return json({ error: 'Application not found' }, 404)

  if (!MUTABLE_STATUSES.includes(application.status)) {
    return json({ error: `Cannot change passport on a ${application.status} application.` }, 422)
  }

  // Verify the passport belongs to the correct crew member
  const { data: passport, error: ppErr } = await (supabaseAdmin as any)
    .from('crew_passports')
    .select('id, crew_id')
    .eq('id', body.passport_id)
    .maybeSingle()

  if (ppErr || !passport) return json({ error: 'Passport not found' }, 404)

  if (passport.crew_id !== application.crew_member_id) {
    return json({ error: 'Passport does not belong to this application\'s crew member.' }, 422)
  }

  const { error: updateErr } = await (supabaseAdmin as any)
    .from('visa_applications')
    .update({
      selected_passport_id: body.passport_id,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', applicationId)

  if (updateErr) return json({ error: updateErr.message }, 500)

  return json({ ok: true, selected_passport_id: body.passport_id })
}
