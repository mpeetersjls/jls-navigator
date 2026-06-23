/**
 * QuickBooks invoice doc-number self-heal — faithful port of the n8n "Heal-*"
 * routine. When two invoices end up with the same DocNumber, the later collider
 * (if still unpaid AND not emailed) is renumbered to the next free number for its
 * prefix via the atomic next_doc_number allocator; paid/sent collisions or failed
 * verifications raise an alert for a human instead.
 */
import { createClient } from '@supabase/supabase-js'
import { qboRequest, qboQuery } from './qbo.server'

function admin() {
  return createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
}

export type HealResult =
  | { action: 'skip' }
  | { action: 'hold'; reason: string }
  | { action: 'bumped'; oldDocNumber: string; newDocNumber: string }
  | { action: 'alert'; reason: string }

/** Decide + apply a doc-number heal for a freshly-fetched invoice. Best-effort:
 *  returns 'skip' and swallows nothing critical to invoicing. */
export async function healInvoiceDocNumber(invoice: any): Promise<HealResult> {
  const sb = admin()
  const docNumber = String(invoice?.DocNumber ?? '')
  if (!invoice?.Id || !docNumber) return { action: 'skip' }

  // Find every invoice sharing this DocNumber.
  const resp = await qboQuery(`select Id, DocNumber, MetaData, Balance, TotalAmt, EmailStatus from Invoice where DocNumber = '${docNumber.replace(/'/g, "''")}'`)
  const dupes: any[] = resp?.QueryResponse?.Invoice ?? []
  if (dupes.length <= 1) return { action: 'skip' }

  // Earliest CreateTime keeps the original number; only a later collider is bumped.
  dupes.sort((a, b) => new Date(a.MetaData.CreateTime).getTime() - new Date(b.MetaData.CreateTime).getTime())
  if (String(dupes[0].Id) === String(invoice.Id)) return { action: 'skip' }

  // Safety gate: only auto-rewrite if unpaid AND not yet emailed.
  const unpaid = Number(invoice.Balance) === Number(invoice.TotalAmt)
  const notSent = (invoice.EmailStatus || 'NotSet') !== 'EmailSent'
  if (!unpaid || !notSent) {
    await sb.from('heal_alerts').insert({ doc_id: String(invoice.Id), old_doc_number: docNumber, reason: 'paid_or_sent_held_for_human' })
    return { action: 'hold', reason: 'paid_or_sent_held_for_human' }
  }

  // prefix + zero-padded numeric suffix; floor = max suffix across the clash set.
  const m = docNumber.match(/^(.*?)(\d+)$/)
  const prefix = m ? m[1] : ''
  const width = m ? m[2].length : 0
  let floor = 0
  for (const x of dupes) {
    const mm = String(x.DocNumber || '').match(/^(.*?)(\d+)$/)
    if (mm && mm[1] === prefix) floor = Math.max(floor, parseInt(mm[2], 10))
  }

  // Atomically allocate the next free number for this prefix.
  const { data: next, error: allocErr } = await sb.rpc('next_doc_number', { p_prefix: prefix, p_floor: floor })
  if (allocErr || next == null) throw new Error(`Allocator failed: ${allocErr?.message ?? 'no number'}`)
  const newDocNumber = prefix + String(next).padStart(width, '0')

  // Write the new number (sparse update).
  await qboRequest('POST', '/invoice?minorversion=73', {
    Id: String(invoice.Id), SyncToken: String(invoice.SyncToken), sparse: true, DocNumber: newDocNumber,
  })

  // Verify it's now unique.
  const v = await qboQuery(`select Id, DocNumber from Invoice where DocNumber = '${newDocNumber.replace(/'/g, "''")}'`)
  if ((v?.QueryResponse?.Invoice ?? []).length <= 1) {
    await sb.from('heal_audit').insert({ doc_id: String(invoice.Id), prefix, old_doc_number: docNumber, new_doc_number: newDocNumber })
    return { action: 'bumped', oldDocNumber: docNumber, newDocNumber }
  }
  await sb.from('heal_alerts').insert({ doc_id: String(invoice.Id), old_doc_number: docNumber, reason: 'verify_failed_still_duplicate' })
  return { action: 'alert', reason: 'verify_failed_still_duplicate' }
}
