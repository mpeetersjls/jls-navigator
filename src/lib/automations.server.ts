/**
 * Automation run tracking. Any automation — a worker cron, an n8n workflow, or an
 * edge function — reports its runs here so the Developer → Automations section can
 * show hits, successes, errors and retries. Best-effort: logging never throws, so
 * it can never break the automation it's tracking.
 */
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
}

export type RunStatus = 'hit' | 'running' | 'success' | 'error' | 'retry'

export interface RunEvent {
  key: string                 // stable automation key (e.g. "qb-invoice-webhook")
  status: RunStatus
  detail?: string | null
  name?: string               // used only when first registering the automation
  source?: string             // 'worker-cron' | 'edge-function' | 'n8n'
  trigger_type?: string       // 'schedule' | 'webhook' | 'event' | 'manual'
  category?: string
}

/** Record a single automation run + roll the parent automation's last-run state. */
export async function logAutomationRun(ev: RunEvent): Promise<void> {
  if (!ev.key) return
  try {
    const sb = admin()
    const now = new Date().toISOString()

    // Roll the registry row's last-run state; register it on first sighting so
    // automations that report in are auto-discovered without clobbering existing
    // metadata (name/description/category) of already-registered ones.
    const { data: updated } = await sb.from('automations')
      .update({ last_run_at: now, last_status: ev.status, last_detail: ev.detail ?? null, updated_at: now })
      .eq('key', ev.key)
      .select('id')
    if (!updated || updated.length === 0) {
      await sb.from('automations').insert({
        key: ev.key,
        name: ev.name ?? ev.key,
        source: ev.source ?? 'external',
        trigger_type: ev.trigger_type ?? 'webhook',
        category: ev.category ?? 'External',
        enabled: true,
        last_run_at: now, last_status: ev.status, last_detail: ev.detail ?? null,
      })
    }

    await sb.from('automation_runs').insert({
      automation_key: ev.key, status: ev.status, detail: ev.detail ?? null,
      started_at: now, finished_at: now,
    })
  } catch (e) {
    console.error('[automation-log] failed:', e)
  }
}

/** Wrap a job promise so its run is logged (running → success/error) automatically. */
export async function trackRun<T>(ev: Omit<RunEvent, 'status'>, job: () => Promise<T>): Promise<T> {
  try {
    const r = await job()
    await logAutomationRun({ ...ev, status: 'success' })
    return r
  } catch (e: any) {
    await logAutomationRun({ ...ev, status: 'error', detail: e?.message ?? String(e) })
    throw e
  }
}
