import { useState, useEffect } from 'react'
import { COLORS, FONTS } from '@/lib/tokens'
import { DateInputDMY } from '@/components/ui/date-input-dmy'
import type { Passport } from './PassportDetailsPage.types'

export interface AddPassportModalProps {
  crewId:           string
  existingCount:    number  // how many passports already exist
  authToken:        string
  onSaved:          (passport: Passport) => void
  onClose:          () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontFamily: FONTS.display, fontSize: 13, color: COLORS.frost,
  background: COLORS.abyss, border: `1px solid var(--border)`,
  borderRadius: 7, padding: '9px 12px', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: FONTS.display, fontSize: 10,
  fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: COLORS.muted, marginBottom: 6,
}

export function AddPassportModal({
  crewId,
  existingCount,
  authToken,
  onSaved,
  onClose,
}: AddPassportModalProps) {
  const [countryOfIssue, setCountryOfIssue] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [nationality,    setNationality]    = useState('')
  const [issueDate,      setIssueDate]      = useState('')
  const [expiryDate,     setExpiryDate]     = useState('')
  const [isPrimary,      setIsPrimary]      = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const isFirst = existingCount === 0

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!countryOfIssue.trim()) { setError('Country of issue is required.'); return }
    if (!passportNumber.trim())  { setError('Passport number is required.'); return }
    if (!nationality.trim())     { setError('Nationality is required.'); return }
    if (!issueDate)              { setError('Issue date is required.'); return }
    if (!expiryDate)             { setError('Expiry date is required.'); return }

    if (expiryDate <= issueDate) {
      setError('Expiry date must be after issue date.')
      return
    }

    if (existingCount >= 3) {
      setError('Maximum of 3 passports allowed per crew member.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/crew/${crewId}/passports`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          country_of_issue: countryOfIssue.trim(),
          passport_number:  passportNumber.trim(),
          nationality:      nationality.trim(),
          issue_date:       issueDate,
          expiry_date:      expiryDate,
          is_primary:       isFirst ? true : isPrimary,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save passport.')
        return
      }

      const p = data.passport
      onSaved({
        id:             p.id,
        countryOfIssue: p.issuing_country,
        passportNumber: p.passport_number,
        nationality:    p.nationality,
        issueDate:      p.issue_date,
        expiryDate:     p.expiry_date,
        isPrimary:      p.is_primary,
        isExpired:      p.is_expired,
      })
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--card)', border: `1px solid var(--border)`,
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          fontFamily: FONTS.display,
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: `1px solid var(--border)`,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.frost }}>
            Add Passport
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: COLORS.muted, fontSize: 20, lineHeight: 1, padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Country of issue */}
          <div>
            <label style={labelStyle}>Country of issue *</label>
            <input
              style={inputStyle}
              type="text"
              value={countryOfIssue}
              onChange={e => setCountryOfIssue(e.target.value)}
              placeholder="e.g. United Kingdom"
              required
            />
          </div>

          {/* Passport number */}
          <div>
            <label style={labelStyle}>Passport number *</label>
            <input
              style={{ ...inputStyle, fontFamily: 'Courier New, monospace', letterSpacing: '0.06em' }}
              type="text"
              value={passportNumber}
              onChange={e => setPassportNumber(e.target.value)}
              placeholder="e.g. AB1234567"
              required
            />
          </div>

          {/* Nationality */}
          <div>
            <label style={labelStyle}>Nationality *</label>
            <input
              style={inputStyle}
              type="text"
              value={nationality}
              onChange={e => setNationality(e.target.value)}
              placeholder="e.g. British"
              required
            />
          </div>

          {/* Issue / Expiry dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Issue date *</label>
              <DateInputDMY style={inputStyle} value={issueDate} onChange={setIssueDate} />
            </div>
            <div>
              <label style={labelStyle}>Expiry date *</label>
              <DateInputDMY style={inputStyle} value={expiryDate} onChange={setExpiryDate} />
            </div>
          </div>

          {/* "Set as primary" — only shown when ≥1 passport already exists */}
          {!isFirst && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              cursor: 'pointer', fontFamily: FONTS.display, fontSize: 13, color: COLORS.frost,
            }}>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={e => setIsPrimary(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: COLORS.signal, cursor: 'pointer' }}
              />
              Set as primary passport
            </label>
          )}

          {/* Error */}
          {error && (
            <div style={{
              fontFamily: FONTS.display, fontSize: 12, color: COLORS.warn,
              background: `${COLORS.warn}14`, border: `1px solid ${COLORS.warn}50`,
              borderRadius: 7, padding: '9px 12px',
            }}>
              {error}
            </div>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontFamily: FONTS.display, fontSize: 13, fontWeight: 600,
                color: COLORS.muted, background: 'none',
                border: `1px solid var(--border)`, borderRadius: 7,
                padding: '9px 20px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                fontFamily: FONTS.display, fontSize: 13, fontWeight: 700,
                color: '#fff', background: COLORS.signal,
                border: 'none', borderRadius: 7,
                padding: '9px 24px', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save passport'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
