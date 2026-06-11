import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { RBACMatrix } from '@/components/admin/rbac/RBACMatrix'
import { COLORS } from '@/lib/tokens'
import type { PermissionRule } from '@/lib/admin/types'

export const Route = createFileRoute('/_app/admin/permissions')({
  component: PermissionsPage,
  head: () => ({ meta: [{ title: 'Permissions — Admin — Polaris' }] }),
})

function PermissionsPage() {
  const { session } = useAuth()
  const token = (session as any)?.access_token ?? ''

  const [rules,   setRules]   = useState<PermissionRule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setRules(data.rules ?? [])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchRules() }, [fetchRules])

  return (
    <div style={{ maxWidth: 1100 }}>
      <p
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize:   11,
          color:      COLORS.muted,
          marginBottom: 16,
        }}
      >
        Click any cell to edit the scope for that role/action combination.
        Changes take effect on the user's next JWT refresh.
      </p>

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
          <RBACMatrix rules={rules} onRefresh={fetchRules} />
        )}
      </div>
    </div>
  )
}
