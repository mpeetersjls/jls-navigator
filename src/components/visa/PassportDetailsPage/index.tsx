import { useState, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { COLORS, FONTS } from '@/lib/tokens'
import { useAuth } from '@/lib/auth'
import { PassportCard } from './PassportCard'
import { AddPassportModal } from './AddPassportModal'
import type { Passport, PassportRow } from './PassportDetailsPage.types'
import { rowToPassport } from './PassportDetailsPage.types'

const MAX_PASSPORTS = 3
const GREEN = '#1D9E75'

export function PassportDetailsPage() {
  const { session } = useAuth()
  const navigate    = useNavigate()
  const search      = useSearch({ strict: false }) as {
    crewId?:       string
    applicationId?: string
    country?:      string
  }
  const crewId        = search.crewId        ?? ''
  const applicationId = search.applicationId ?? ''
  const country       = search.country       ?? 'UAE'
  const authToken     = session?.access_token ?? ''

  const [passports,  setPassports]  = useState<Passport[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading,  setIsLoading]  = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  // Load passports on mount
  useEffect(() => {
    if (!crewId || !authToken) return
    void loadPassports()
  }, [crewId, authToken]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPassports() {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/crew/${crewId}/passports`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load passports')
      setPassports((data.passports as PassportRow[]).map(rowToPassport))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load passports')
    } finally {
      setIsLoading(false)
    }
  }

  function handlePassportSaved(p: Passport) {
    setPassports(prev => {
      // If new passport is primary, demote others
      if (p.isPrimary) {
        return [...prev.map(x => ({ ...x, isPrimary: false })), p]
      }
      return [...prev, p]
    })
    setModalOpen(false)
  }

  async function handleRemove(id: string) {
    try {
      const res = await fetch(`/api/crew/${crewId}/passports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove passport')
      setPassports((data.passports as PassportRow[]).map(rowToPassport))
      if (selectedId === id) setSelectedId(null)
    } catch {
      // Non-fatal: reload to sync
      void loadPassports()
    }
  }

  async function handleContinue() {
    if (!canContinue || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      if (applicationId) {
        const res = await fetch(`/api/visa/${applicationId}/passport`, {
          method:  'PATCH',
          headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${authToken}`,
          },
          body: JSON.stringify({ passport_id: selectedId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to save selection')
      }
      void navigate({
        to:     '/crew-immigration/visas/supporting-docs',
        search: { applicationId },
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canContinue = selectedId !== null && passports.length > 0
  const atLimit     = passports.length >= MAX_PASSPORTS
  const selectedPassport = passports.find(p => p.id === selectedId) ?? null

  if (isLoading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', textAlign: 'center',
                    fontFamily: FONTS.display, fontSize: 13, color: COLORS.muted }}>
        Loading passports…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px', fontFamily: FONTS.display }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 700, color: COLORS.frost, margin: 0, marginBottom: 6 }}>
          Passport Details
        </h1>
        <p style={{ fontFamily: FONTS.display, fontSize: 13, color: COLORS.muted, margin: 0, lineHeight: 1.6 }}>
          Select the passport you are using for this{' '}
          <span style={{ color: COLORS.frost, fontWeight: 600 }}>{country}</span>{' '}
          application. You must explicitly choose even if only one passport is listed.
        </p>
      </div>

      {loadError && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: `${COLORS.warn}14`, border: `1px solid ${COLORS.warn}40`,
          fontFamily: FONTS.display, fontSize: 12, color: COLORS.warn,
        }}>
          {loadError}
        </div>
      )}

      {/* Empty state */}
      {passports.length === 0 ? (
        <div style={{
          background: COLORS.abyss, border: `1px solid var(--border)`,
          borderRadius: 12, padding: 36,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 12,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
               stroke={COLORS.steel} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M7 8h3M7 12h3M7 16h3M14 8h3M14 12h3" />
          </svg>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: COLORS.frost }}>
            No passports on file
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 13, color: COLORS.muted, maxWidth: 320 }}>
            Add one below to continue.
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              fontFamily: FONTS.display, fontSize: 13, fontWeight: 700,
              color: '#fff', background: GREEN,
              border: 'none', borderRadius: 8,
              padding: '10px 24px', cursor: 'pointer', marginTop: 4,
            }}
          >
            + Add Passport
          </button>
        </div>
      ) : (
        <>
          {/* Passport list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {passports.map(p => (
              <PassportCard
                key={p.id}
                passport={p}
                selected={selectedId === p.id}
                onSelect={() => setSelectedId(p.id)}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* Add another / limit note */}
          {atLimit ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8,
              background: `${COLORS.signal}0A`, border: `1px solid ${COLORS.signal}20`,
              fontFamily: FONTS.display, fontSize: 12, color: COLORS.muted, marginBottom: 14,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke={COLORS.signal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Maximum of 3 passports can be added per crew member.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                width: '100%', padding: '12px 20px', marginBottom: 14,
                fontFamily: FONTS.display, fontSize: 13, color: COLORS.muted,
                background: 'transparent', border: `1px dashed var(--border)`,
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.borderColor = COLORS.signal
                el.style.color       = COLORS.signal
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.borderColor = 'var(--border)'
                el.style.color       = COLORS.muted
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add another passport
            </button>
          )}

          {/* Selection note */}
          {selectedPassport && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 8, marginBottom: 14,
              background: `${GREEN}12`, border: `1px solid ${GREEN}40`,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontFamily: FONTS.display, fontSize: 13, color: GREEN }}>
                {selectedPassport.countryOfIssue} passport ({selectedPassport.passportNumber}) selected for this application.
              </span>
            </div>
          )}
        </>
      )}

      {/* Save error */}
      {saveError && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: `${COLORS.warn}14`, border: `1px solid ${COLORS.warn}40`,
          fontFamily: FONTS.display, fontSize: 12, color: COLORS.warn,
        }}>
          {saveError}
        </div>
      )}

      {/* Navigation row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 20, borderTop: `1px solid var(--border)`,
      }}>
        <button
          type="button"
          onClick={() => navigate({ to: -1 as never })}
          style={{
            fontFamily: FONTS.display, fontSize: 13, fontWeight: 600,
            color: COLORS.muted, background: 'none',
            border: `1px solid var(--border)`, borderRadius: 7,
            padding: '9px 20px', cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!canContinue || saving}
          onClick={handleContinue}
          style={{
            fontFamily: FONTS.display, fontSize: 13, fontWeight: 700,
            color: '#fff', background: COLORS.signal,
            border: 'none', borderRadius: 7,
            padding: '9px 28px',
            cursor: canContinue && !saving ? 'pointer' : 'not-allowed',
            opacity: canContinue && !saving ? 1 : 0.45,
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Continue →'}
        </button>
      </div>

      {/* Add Passport Modal */}
      {modalOpen && (
        <AddPassportModal
          crewId={crewId}
          existingCount={passports.length}
          authToken={authToken}
          onSaved={handlePassportSaved}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
