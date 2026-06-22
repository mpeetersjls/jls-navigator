import { createClient } from '@supabase/supabase-js'
import { requireAdminAccess } from '@/lib/admin/access'
import { logAuditEvent } from '@/lib/admin/audit'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

const handlers = {
  GET: async ({ request }: { request: Request }) => {
    const session = await requireAdminAccess(request)
    if (!session.ok) return session.response

    const sb = getAdmin()
    const { data, error } = await sb
      .from('role_permissions')
      .select('id, role, action, scope, resource')
      .order('role')
      .order('action')

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ rules: data ?? [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },

  PATCH: async ({ request }: { request: Request }) => {
    const session = await requireAdminAccess(request, ['global_admin'])
    if (!session.ok) return session.response

    const body = await request.json() as { id: string; scope: string }

    if (!body.id || !body.scope) {
      return new Response(JSON.stringify({ error: 'id and scope are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const sb = getAdmin()
    const { data: existing } = await sb.from('role_permissions').select('role, action').eq('id', body.id).single()

    const { error } = await sb.from('role_permissions')
      .update({ scope: body.scope, updated_at: new Date().toISOString() })
      .eq('id', body.id)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    await logAuditEvent({
      event_type:  'PERM',
      actor_id:    session.user.id,
      actor_email: session.user.email,
      actor_role:  session.user.role,
      target_type: 'role_permission',
      target_id:   body.id,
      detail:      `Permission updated: ${existing?.role}/${existing?.action} → scope: ${body.scope}`,
      ip_address:  request.headers.get('x-forwarded-for'),
      result:      'success',
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

/** Worker-entry dispatcher for /api/admin/permissions (GET matrix, PATCH rule). */
export async function adminPermissionsHandler(request: Request): Promise<Response> {
  if (request.method === 'GET')   return handlers.GET({ request })
  if (request.method === 'PATCH') return handlers.PATCH({ request })
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  })
}
