import { createClient } from '@supabase/supabase-js'
import { requireAdminAccess } from '@/lib/admin/access'
import { logAuditEvent } from '@/lib/admin/audit'
import type { PolarisRole } from '@/lib/admin/types'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

const handlers = {
  PATCH: async ({ request, params }: { request: Request; params: { id: string } }) => {
    const session = await requireAdminAccess(request)
    if (!session.ok) return session.response

    const { id } = params
    const body = await request.json() as {
      action: 'role' | 'suspend' | 'unsuspend' | 'reset_password' | 'resend_invite'
      role?: PolarisRole
    }

    const sb = getAdmin()

    // Account actions that email the user — resolve their address from auth.users.
    if (body.action === 'reset_password' || body.action === 'resend_invite') {
      const { data: ur } = await sb.from('user_roles').select('user_id').eq('id', id).single()
      if (!ur?.user_id) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        })
      }
      const { data: au } = await sb.auth.admin.getUserById(ur.user_id)
      const email = au?.user?.email
      if (!email) {
        return new Response(JSON.stringify({ error: 'No email on file for this user' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        })
      }
      const base = process.env.VITE_APP_URL ?? new URL(request.url).origin

      const { error: mailErr } = body.action === 'reset_password'
        ? await sb.auth.resetPasswordForEmail(email, { redirectTo: `${base}/auth` })
        : await sb.auth.admin.inviteUserByEmail(email, { redirectTo: `${base}/auth/mfa-setup` })

      if (mailErr) {
        return new Response(JSON.stringify({ error: mailErr.message }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        })
      }

      await logAuditEvent({
        event_type:  body.action === 'reset_password' ? 'AUTH' : 'PERM',
        actor_id:    session.user.id,
        actor_email: session.user.email,
        actor_role:  session.user.role,
        target_type: 'user',
        target_id:   id,
        detail:      body.action === 'reset_password'
          ? `Password reset email sent to ${email}`
          : `Invite re-sent to ${email}`,
        ip_address:  request.headers.get('x-forwarded-for'),
        result:      'success',
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'role' && body.role) {
      const { data: existing } = await sb.from('user_roles').select('role').eq('id', id).single()
      const oldRole = existing?.role ?? 'unknown'

      await sb.from('user_roles').update({ role: body.role }).eq('id', id)

      await logAuditEvent({
        event_type:  'PERM',
        actor_id:    session.user.id,
        actor_email: session.user.email,
        actor_role:  session.user.role,
        target_type: 'user',
        target_id:   id,
        detail:      `Role updated → ${body.role} (was: ${oldRole})`,
        ip_address:  request.headers.get('x-forwarded-for'),
        result:      'success',
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'suspend' || body.action === 'unsuspend') {
      const active = body.action === 'unsuspend'
      await sb.from('user_roles').update({ is_active: active }).eq('id', id)

      await logAuditEvent({
        event_type:  'ADMIN',
        actor_id:    session.user.id,
        actor_email: session.user.email,
        actor_role:  session.user.role,
        target_type: 'user',
        target_id:   id,
        detail:      `User ${active ? 'unsuspended' : 'suspended'}`,
        ip_address:  request.headers.get('x-forwarded-for'),
        result:      'success',
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  },

  DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
    const session = await requireAdminAccess(request)
    if (!session.ok) return session.response

    const { id } = params
    const sb = getAdmin()

    await sb.from('user_roles').update({ is_active: false }).eq('id', id)

    await logAuditEvent({
      event_type:  'ADMIN',
      actor_id:    session.user.id,
      actor_email: session.user.email,
      actor_role:  session.user.role,
      target_type: 'user',
      target_id:   id,
      detail:      'User deactivated (soft delete)',
      ip_address:  request.headers.get('x-forwarded-for'),
      result:      'success',
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

/** Worker-entry dispatcher for /api/admin/users/:id (PATCH role/suspend, DELETE). */
export async function adminUserByIdHandler(request: Request, id: string): Promise<Response> {
  if (request.method === 'PATCH')  return handlers.PATCH({ request, params: { id } })
  if (request.method === 'DELETE') return handlers.DELETE({ request, params: { id } })
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  })
}
