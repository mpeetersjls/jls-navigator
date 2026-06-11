import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { AuditTable } from '@/components/admin/audit/AuditTable'
import { COLORS } from '@/lib/tokens'
import type { AuditEvent } from '@/lib/admin/types'
import type { AuditFilterState } from '@/components/admin/audit/AuditFilters'

export const Route = createFileRoute('/_app/admin/audit')({
  component: AuditLogPage,
  head: () => ({ meta: [{ title: 'Audit Log — Admin — Polaris' }] }),
})

const DEFAULT_FILTERS: AuditFilterState = {
  event_type: '',
  result:     '',
  actor:      '',
  from:       '',
  to:         '',
}

function AuditLogPage() {
  const { session } = useAuth()
  const token = (session as any)?.access_token ?? ''

  const [events,  setEvents]  = useState<AuditEvent[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<AuditFilterState>(DEFAULT_FILTERS)
  const [page,    setPage]    = useState(1)

  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (filters.event_type) params.set('event_type', filters.event_type)
      if (filters.result)     params.set('result',     filters.result)
      if (filters.actor)      params.set('actor',      filters.actor)
      if (filters.from)       params.set('from',       filters.from)
      if (filters.to)         params.set('to',         filters.to)

      const res  = await fetch(`/api/admin/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setEvents(data.events ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [token, filters, page])

  useEffect(() => { fetchData() }, [fetchData])

  function handleFilterChange(f: AuditFilterState) {
    setFilters(f)
    setPage(1)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div style={{ maxWidth: 1100 }}>
      <div
        style={{
          background:   COLORS.abyss,
          border:       `1px solid ${COLORS.deep}`,
          borderRadius: 8,
          overflow:     'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: COLORS.steel, fontSize: 12 }}>
            Loading…
          </div>
        ) : (
          <AuditTable
            events={events}
            total={total}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'flex-end',
            gap:            8,
            marginTop:      12,
          }}
        >
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              fontSize:     11,
              color:        COLORS.muted,
              border:       `1px solid ${COLORS.deep}`,
              background:   'transparent',
              borderRadius: 5,
              padding:      '4px 10px',
              cursor:       page === 1 ? 'default' : 'pointer',
              opacity:      page === 1 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 11, color: COLORS.steel }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              fontSize:     11,
              color:        COLORS.muted,
              border:       `1px solid ${COLORS.deep}`,
              background:   'transparent',
              borderRadius: 5,
              padding:      '4px 10px',
              cursor:       page === totalPages ? 'default' : 'pointer',
              opacity:      page === totalPages ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
