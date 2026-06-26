/**
 * QBO customer directory (authenticated, bearer) — used by the Integrations
 * "Vessel ↔ QuickBooks customer" link manager.
 *   GET /api/qb/customers  -> { ok, customers: [{ id, displayName, trn }] }
 *
 * Linking itself (writing yachts.qbo_customer_id) is done client-side via the
 * authenticated Supabase client; this endpoint only exposes the QBO directory,
 * which requires the server-side QBO token.
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { qboConfigured, qboQuery } from '@/lib/qb/qbo.server'

const db = () => supabaseAdmin as any
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

export async function qbCustomersHandler(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401)
  const { data: { user }, error: authErr } = await db().auth.getUser(auth.slice(7))
  if (authErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401)
  if (!qboConfigured()) return json({ ok: false, error: 'QuickBooks is not connected.', code: 'not_configured' }, 503)

  try {
    const customers: Array<{ id: string; displayName: string; trn: string | null }> = []
    const PAGE = 1000
    for (let start = 1; start <= 5000; start += PAGE) {
      const res = await qboQuery(
        `select Id, DisplayName, PrimaryTaxIdentifier from Customer where Active = true startposition ${start} maxresults ${PAGE}`,
      )
      const rows = res?.QueryResponse?.Customer ?? []
      for (const c of rows) customers.push({ id: c.Id, displayName: c.DisplayName, trn: c.PrimaryTaxIdentifier ?? null })
      if (rows.length < PAGE) break
    }
    customers.sort((a, b) => a.displayName.localeCompare(b.displayName))
    return json({ ok: true, customers })
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message ?? e) }, 502)
  }
}
