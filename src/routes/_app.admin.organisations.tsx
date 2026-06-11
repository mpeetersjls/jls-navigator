import { createFileRoute } from '@tanstack/react-router'
import { COLORS } from '@/lib/tokens'

export const Route = createFileRoute('/_app/admin/organisations')({
  component: OrganisationsPage,
  head: () => ({ meta: [{ title: 'Organisations — Admin — Polaris' }] }),
})

function OrganisationsPage() {
  return (
    <div
      style={{
        background:   COLORS.abyss,
        border:       `1px solid ${COLORS.deep}`,
        borderRadius: 8,
        padding:      '32px 24px',
        maxWidth:     700,
        textAlign:    'center',
      }}
    >
      <p
        style={{
          fontFamily:    "'Space Grotesk', sans-serif",
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color:         COLORS.steel,
          marginBottom:  8,
        }}
      >
        Organisations
      </p>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: COLORS.muted }}>
        Organisation management will be built in a future sprint.
        Requires migrations 010–011 to be deployed.
      </p>
    </div>
  )
}
