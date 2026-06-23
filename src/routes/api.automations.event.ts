/**
 * POST /api/automations/event
 *
 * Reliable ingestion endpoint for automation run tracking. Any automation —
 * an n8n workflow (add an HTTP node), an edge function, or external job — POSTs
 * a run event here and it shows up in Developer → Automations with hit / error /
 * retry counts.
 *
 * Auth: either a logged-in admin (Bearer token) OR a shared secret header
 * `x-automation-token: <AUTOMATION_INGEST_TOKEN>` so headless automations (n8n)
 * can report without a user session.
 *
 * Body: { key, status, detail?, name?, source?, trigger_type?, category? }
 *   status ∈ hit | running | success | error | retry
 */
import { createClient } from '@supabase/supabase-js'
import { logAutomationRun, type RunStatus } from '@/lib/automations.server'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const VALID: RunStatus[] = ['hit', 'running', 'success', 'error', 'retry']

export async function automationEventHandler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Auth — shared token (headless automations) or an authenticated user.
  const token = process.env.AUTOMATION_INGEST_TOKEN
  const headerToken = request.headers.get('x-automation-token')
  let authed = !!token && headerToken === token
  if (!authed) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth.startsWith('Bearer ')) {
      const sb = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
      const { data } = await sb.auth.getUser(auth.slice(7))
      authed = !!data?.user
    }
  }
  if (!authed) return json({ error: 'Unauthorized' }, 401)

  const body = await request.json().catch(() => ({})) as any
  if (!body.key || !body.status) return json({ error: 'key and status are required' }, 400)
  if (!VALID.includes(body.status)) return json({ error: `status must be one of ${VALID.join(', ')}` }, 400)

  await logAutomationRun({
    key: String(body.key),
    status: body.status,
    detail: body.detail ?? null,
    name: body.name,
    source: body.source,
    trigger_type: body.trigger_type,
    category: body.category,
  })
  return json({ ok: true })
}
