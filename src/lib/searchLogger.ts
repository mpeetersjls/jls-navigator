/**
 * Structured logger for crew search attempts.
 * INFO  — results returned
 * WARN  — zero results (potential search failure worth investigating)
 * ERROR — query failure
 * POLARIS-SEARCH-004
 */
import { createClient } from '@supabase/supabase-js'

export interface SearchLogEntry {
  userId:     string
  rawInput:   { name: string; dob: string }
  parsed:     { searchText: string; dob: string | null }
  resultCount: number
  durationMs: number
  error:      string | null
  zeroResult: boolean
}

export const searchLogger = {
  log(entry: SearchLogEntry): void {
    const level = entry.error
      ? 'ERROR'
      : entry.zeroResult
        ? 'WARN'
        : 'INFO'

    const output = {
      level,
      service:   'crew-search',
      timestamp: new Date().toISOString(),
      ...entry,
    }

    // Primary: structured JSON to stdout → picked up by Cloudflare log aggregator
    console.log(JSON.stringify(output))

    // Secondary: persist to search_audit_log for in-app diagnostics
    // Fire-and-forget — never blocks the search response
    insertAuditLog(level, output).catch(() => {})
  },
}

async function insertAuditLog(level: string, payload: object): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const admin = createClient(url, key)
  await (admin as any)
    .from('search_audit_log')
    .insert({ service: 'crew-search', level, payload })
}
