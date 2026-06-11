import { createClient } from '@supabase/supabase-js'
import type { PolarisRole } from './types'
import { DEVELOPER_EMAILS } from '@/lib/leo-access'

export interface AdminSession {
  ok: true
  user: {
    id: string
    email: string
    role: PolarisRole
    org_id: string | null
  }
}

export interface AdminDenied {
  ok: false
  response: Response
}

export type AccessResult = AdminSession | AdminDenied

function getAdmin() {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createClient(url, key, { auth: { persistSession: false } })
}

function denied(status: number, message: string): AdminDenied {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  }
}

export async function requireAdminAccess(
  request: Request,
  allowedRoles: PolarisRole[] = ['global_admin', 'org_admin'],
): Promise<AccessResult> {
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return denied(401, 'Unauthorized')

  const token = authHeader.slice(7)
  const sb    = getAdmin()

  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return denied(401, 'Invalid token')

  const email = user.email ?? ''

  // Role from app_metadata (set by JWT hook once migrations are live),
  // falling back to developer email list for the current build phase.
  const role: PolarisRole =
    (user.app_metadata?.role as PolarisRole) ??
    (DEVELOPER_EMAILS.includes(email.toLowerCase()) ? 'global_admin' : null as unknown as PolarisRole)

  if (!role || !allowedRoles.includes(role)) {
    return denied(403, 'Forbidden — insufficient role')
  }

  const org_id: string | null = user.app_metadata?.org_id ?? null

  return {
    ok: true,
    user: { id: user.id, email, role, org_id },
  }
}
