import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import type { AuditFilterState } from './AuditFilters'

export function AuditExportButton({ filters }: { filters: AuditFilterState }) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.event_type) params.set('event_type', filters.event_type)
      if (filters.result)     params.set('result',     filters.result)
      if (filters.actor)      params.set('actor',      filters.actor)
      if (filters.from)       params.set('from',       filters.from)
      if (filters.to)         params.set('to',         filters.to)

      const res = await fetch(`/api/admin/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${(session as any)?.access_token ?? ''}` },
      })

      if (!res.ok) return

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `polaris-audit-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] text-white/50
                 hover:bg-white/5 hover:text-white/70 transition-colors disabled:opacity-40"
    >
      {loading ? 'Exporting…' : 'Export CSV'}
    </button>
  )
}
