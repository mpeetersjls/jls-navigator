import { createClient } from '@supabase/supabase-js'
import { requireAdminAccess } from '@/lib/admin/access'

function getAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** GET /api/admin/stats — Admin Panel dashboard counters (via admin_user_stats RPC). */
export async function adminStatsHandler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const session = await requireAdminAccess(request)
  if (!session.ok) return session.response

  const sb = getAdmin()
  const { data, error } = await sb.rpc('admin_user_stats')
  if (error) return json({ error: error.message }, 500)
  return json(data ?? { total_users: 0, mfa_enrolled: 0, active_sessions: 0, audit_today: 0 })
}
