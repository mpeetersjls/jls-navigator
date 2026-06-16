// Edge Function: qb-reconcile-logs
// Native re-creation of the n8n "Update Records in Supabase" workflow.
// Pulls all Estimate/Invoice IDs from QuickBooks Online and deletes "QBO Logs"
// rows whose DocID no longer exists in QB (per DocType: Estimate / Invoice /
// Pro-Forma). Safe by default: dry-run unless ?confirm=1 is passed.
//
// Secrets (set via: supabase secrets set ... on the target project):
//   QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REALM_ID
//   QB_REFRESH_TOKEN              (initial seed; rotated token persisted in qb_oauth)
//   QBO_SUPABASE_URL             (optional — DB holding "QBO Logs"; defaults to this project)
//   QBO_SUPABASE_SERVICE_KEY     (optional — defaults to this project's service role)
//
// Requires a single-row table `qb_oauth (id int pk, refresh_token text,
// access_token text, expires_at timestamptz)` in the QBO Supabase so QuickBooks'
// rotating refresh token is persisted between runs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QB_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function env(k: string): string { return Deno.env.get(k) ?? '' }

function db() {
  const url = env('QBO_SUPABASE_URL') || env('SUPABASE_URL')
  const key = env('QBO_SUPABASE_SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── QuickBooks OAuth (refresh-token flow with rotation persisted in qb_oauth) ──
async function getAccessToken(sb: ReturnType<typeof db>): Promise<{ token: string; realm: string }> {
  const realm = env('QB_REALM_ID')
  const clientId = env('QB_CLIENT_ID')
  const clientSecret = env('QB_CLIENT_SECRET')
  if (!realm || !clientId || !clientSecret) throw new Error('QuickBooks secrets not configured')

  // Prefer a persisted refresh token; fall back to the env seed.
  let refreshToken = env('QB_REFRESH_TOKEN')
  const { data: row } = await sb.from('qb_oauth').select('refresh_token, access_token, expires_at').eq('id', 1).maybeSingle()
  if (row?.refresh_token) refreshToken = row.refresh_token
  if (row?.access_token && row?.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) {
    return { token: row.access_token, realm }
  }
  if (!refreshToken) throw new Error('No QuickBooks refresh token (set QB_REFRESH_TOKEN)')

  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`QB token refresh failed ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const tok = await res.json()
  // Persist the (rotated) refresh token + access token.
  await sb.from('qb_oauth').upsert({
    id: 1,
    refresh_token: tok.refresh_token ?? refreshToken,
    access_token: tok.access_token,
    expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
  })
  return { token: tok.access_token, realm }
}

async function fetchAllIds(token: string, realm: string, entity: 'Estimate' | 'Invoice'): Promise<Set<string>> {
  const ids = new Set<string>()
  let start = 1
  const page = 1000
  for (;;) {
    const q = `SELECT Id FROM ${entity} STARTPOSITION ${start} MAXRESULTS ${page}`
    const url = `${QB_BASE}/${realm}/query?query=${encodeURIComponent(q)}&minorversion=70`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!res.ok) throw new Error(`QB query ${entity} failed ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = await res.json()
    const rows: any[] = json?.QueryResponse?.[entity] ?? []
    for (const r of rows) if (r.Id) ids.add(String(r.Id))
    if (rows.length < page) break
    start += page
  }
  return ids
}

Deno.serve(async (req) => {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
  const confirm = new URL(req.url).searchParams.get('confirm') === '1'
  try {
    const sb = db()
    const { token, realm } = await getAccessToken(sb)

    const estimateIds = await fetchAllIds(token, realm, 'Estimate')
    const invoiceIds = await fetchAllIds(token, realm, 'Invoice')
    const setFor = (docType: string) => (docType === 'Estimate' ? estimateIds : invoiceIds) // Pro-Forma + Invoice ⇒ invoices

    const result: Record<string, { logs: number; stale: number; deleted: number }> = {}
    for (const docType of ['Estimate', 'Invoice', 'Pro-Forma']) {
      const { data: logs } = await sb.from('QBO Logs').select('DocID').eq('DocType', docType)
      const ids = setFor(docType)
      const stale = (logs ?? []).map((l: any) => String(l.DocID)).filter((id: string) => id && !ids.has(id))
      let deleted = 0
      if (confirm && stale.length) {
        const { error } = await sb.from('QBO Logs').delete().eq('DocType', docType).in('DocID', stale)
        if (error) throw new Error(`delete ${docType}: ${error.message}`)
        deleted = stale.length
      }
      result[docType] = { logs: (logs ?? []).length, stale: stale.length, deleted }
    }

    return json({ ok: true, dryRun: !confirm, qb: { estimates: estimateIds.size, invoices: invoiceIds.size }, result })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
