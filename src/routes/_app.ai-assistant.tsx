import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { getAccessLevel, ACCESS_LABELS } from '@/lib/leo-access'
import { LeoPanel } from '@/components/leo/LeoPanel'
import { LeoChat } from '@/components/leo/LeoChat'
import { LeoIcon } from '@/components/leo/LeoIcon'
import { COLORS } from '@/lib/tokens'

export const Route = createFileRoute('/_app/ai-assistant')({
  component: LeoPage,
  head: () => ({ meta: [{ title: 'Leo — Polaris' }] }),
})

function LeoPage() {
  const { user, session } = useAuth()
  const [briefingText, setBriefingText] = useState<string | null>(null)

  const token       = (session as any)?.access_token ?? ''
  const userEmail   = user?.email ?? ''
  const accessLevel = getAccessLevel(userEmail)
  const accessLabel = ACCESS_LABELS[accessLevel]

  // Derive first name from profile or email
  const rawFirst = (user as any)?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]?.split('.')[0]
    ?? 'there'
  const displayName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)

  if (!token) {
    return (
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          height:         '100%',
          color:          COLORS.steel,
          fontFamily:     "'Space Grotesk', sans-serif",
          fontSize:       13,
        }}
      >
        Sign in to access Leo.
      </div>
    )
  }

  return (
    <div style={{ background: COLORS.void, minHeight: '100%', paddingBottom: 48 }}>
      {/* ── Page header ────────────────────────────────────────── */}
      <div
        style={{
          borderBottom:   `1px solid ${COLORS.deep}`,
          padding:        '20px 28px 16px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LeoIcon size={32} variant="leo" />
          <div>
            <h1
              style={{
                fontFamily:    "'Space Grotesk', sans-serif",
                fontSize:      22,
                fontWeight:    700,
                color:         COLORS.leoAmber,
                margin:        0,
                letterSpacing: '-0.01em',
              }}
            >
              Leo
            </h1>
            <p
              style={{
                fontFamily:    "'Space Grotesk', sans-serif",
                fontSize:      10,
                color:         COLORS.steel,
                margin:        '2px 0 0',
                letterSpacing: '0.10em',
                textTransform: 'uppercase' as const,
              }}
            >
              Active Intelligence · Polaris Platform
            </p>
          </div>
        </div>

        {/* Access level badge */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            background:   `rgba(232,160,32,0.08)`,
            border:       `1px solid rgba(232,160,32,0.20)`,
            borderRadius: 20,
            padding:      '4px 12px',
          }}
        >
          <span
            style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   accessLevel === 'developer' ? COLORS.signal : COLORS.leoAmber,
              display:      'inline-block',
            }}
          />
          <span
            style={{
              fontFamily:    "'Space Grotesk', sans-serif",
              fontSize:      10,
              fontWeight:    600,
              color:         COLORS.leoAmber,
              letterSpacing: '0.08em',
            }}
          >
            {accessLabel}
          </span>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div
        style={{
          maxWidth:      880,
          margin:        '0 auto',
          padding:       '24px 28px 0',
          display:       'flex',
          flexDirection: 'column' as const,
          gap:           20,
        }}
      >
        <LeoPanel
          token={token}
          userName={displayName}
          onReady={(text) => setBriefingText(text)}
        />

        {/* Chat panel — reveals after briefing completes */}
        {briefingText !== null && (
          <LeoChat
            token={token}
            userName={displayName}
            briefingText={briefingText}
          />
        )}

        <p
          style={{
            fontFamily:    "'Space Grotesk', sans-serif",
            fontSize:      10,
            color:         COLORS.steel,
            textAlign:     'center' as const,
            letterSpacing: '0.06em',
            marginTop:     4,
          }}
        >
          Leo runs on Claude · Anthropic · Context sourced from live Polaris data
        </p>
      </div>
    </div>
  )
}
