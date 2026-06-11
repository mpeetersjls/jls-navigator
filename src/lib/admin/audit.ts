import { createClient } from '@supabase/supabase-js'
import type { LogAuditEventParams } from './types'

function getAdmin() {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('Supabase admin credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    const sb = getAdmin()
    await sb.from('audit_log').insert({
      event_type:  params.event_type,
      actor_id:    params.actor_id,
      actor_email: params.actor_email,
      actor_role:  params.actor_role,
      target_type: params.target_type  ?? null,
      target_id:   params.target_id   ?? null,
      target_label: params.target_label ?? null,
      detail:      params.detail,
      ip_address:  params.ip_address  ?? null,
      user_agent:  params.user_agent  ?? null,
      result:      params.result,
    })
  } catch (err) {
    console.error('[audit] logAuditEvent failed:', err)
  }
}
