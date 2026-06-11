import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { COLORS } from '@/lib/tokens'

interface Stats {
  totalUsers:      number
  activeSessions:  number
  mfaEnrolled:     number
  auditToday:      number
}

export function AdminStatsBar() {
  const { session } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!session) return
    const token = (session as any).access_token ?? ''

    Promise.all([
      fetch('/api/admin/users?pageSize=1', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch('/api/admin/audit?pageSize=1', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ]).then(([usersData, auditData]) => {
      setStats({
        totalUsers:     usersData.total ?? 0,
        activeSessions: 0,
        mfaEnrolled:    0,
        auditToday:     auditData.total ?? 0,
      })
    }).catch(() => {})
  }, [session])

  const items = [
    { label: 'Total users',        value: stats?.totalUsers,     color: COLORS.signal },
    { label: 'Active sessions',    value: stats?.activeSessions, color: COLORS.frost },
    { label: 'MFA enrolled',       value: stats?.mfaEnrolled,    color: COLORS.frost },
    { label: 'Audit events today', value: stats?.auditToday,     color: COLORS.leoAmber },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          style={{
            background:   COLORS.abyss,
            border:       `1px solid ${COLORS.deep}`,
            borderRadius: 7,
            padding:      '12px 14px',
          }}
        >
          <div
            style={{
              fontFamily:    "'Space Grotesk', sans-serif",
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color:         COLORS.steel,
              marginBottom:  8,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize:   28,
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}
          >
            {value ?? <span style={{ fontSize: 14, color: COLORS.steel }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
