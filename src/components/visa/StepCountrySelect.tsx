/**
 * Polaris — Crew Visa Country Selector
 *
 * Single click  → selects the card (highlighted state), enables Continue
 * Second click  → selects AND immediately proceeds (same as clicking Continue)
 * Double click  → selects AND immediately proceeds
 * Continue btn  → proceeds with the currently selected country
 */

import React, { useCallback } from 'react'
import { COLORS, FONTS } from '@/lib/tokens'
import { SUPPORTED_COUNTRIES, COUNTRY_CONFIGS } from '@/lib/visa/countryConfig'
import type { CountryVisaConfig } from '@/lib/visa/countryConfig'
import type { CrewMember, CrewPassport } from '@/lib/visa/crewMatching'
import type { ComplianceResult } from '@/lib/visa/complianceChecks'

const COUNTRY_LABELS: Record<string, string> = {
  AE: 'UAE Crew Visa',
  OM: 'Oman Crew Visa',
  MV: 'Maldives Crew Visa',
  SA: 'Saudi Arabia Crew Visa',
  QA: 'Qatar Crew Visa',
  BH: 'Bahrain Crew Visa',
  EG: 'Egypt Crew Visa',
}

interface WizardState {
  step: number
  countryCode: string
  crew: CrewMember | null
  isNewCrew: boolean
  passport: CrewPassport | null
  passports: CrewPassport[]
  countryFields: Record<string, string>
  uploadedDocs: Record<string, string>
  complianceResults: ComplianceResult[]
  complianceAcknowledged: boolean
}

interface Props {
  state: WizardState
  onUpdate: (partial: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepCountrySelect({ state, onUpdate, onNext }: Props) {
  const selected = state.countryCode || 'AE'

  const handleCardClick = useCallback(
    (code: string) => {
      if (selected === code) {
        // Second click on already-selected card → proceed immediately
        onNext()
      } else {
        onUpdate({ countryCode: code })
      }
    },
    [selected, onUpdate, onNext]
  )

  const handleCardDoubleClick = useCallback(
    (code: string) => {
      // Double-click always selects + proceeds regardless of prior state
      onUpdate({ countryCode: code })
      onNext()
    },
    [onUpdate, onNext]
  )

  return (
    <div style={{ fontFamily: FONTS.display, color: COLORS.frost }}>
      <h2
        style={{
          fontFamily: FONTS.display,
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.frost,
          marginBottom: 6,
        }}
      >
        Select Destination Country
      </h2>
      <p style={{ fontFamily: FONTS.display, fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>
        Choose the country you are applying a crew visa for.
      </p>
      <p style={{ fontFamily: FONTS.display, fontSize: 12, color: COLORS.steel, marginBottom: 24 }}>
        Click once to select · Click again or double-click to continue directly.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {SUPPORTED_COUNTRIES.map((code) => {
          const config: CountryVisaConfig = COUNTRY_CONFIGS[code]
          const isSelected = selected === code

          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${config.countryName} — ${COUNTRY_LABELS[code]}${isSelected ? '. Selected. Click again to continue.' : ''}`}
              onClick={() => handleCardClick(code)}
              onDoubleClick={() => handleCardDoubleClick(code)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '20px 12px 16px',
                borderRadius: 10,
                border: `2px solid ${isSelected ? COLORS.signal : COLORS.deep}`,
                background: isSelected ? 'rgba(0,196,204,0.08)' : COLORS.abyss,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                outline: 'none',
                boxShadow: isSelected ? `0 0 0 1px ${COLORS.signal}33` : 'none',
              }}
            >
              {/* Selected dot — top-right corner */}
              {isSelected && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: COLORS.signal,
                  }}
                />
              )}

              <span style={{ fontSize: 32, lineHeight: 1 }} aria-hidden="true">
                {config.flag}
              </span>

              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 15,
                  fontWeight: 700,
                  color: isSelected ? COLORS.signal : COLORS.frost,
                  textAlign: 'center',
                }}
              >
                {config.countryName}
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: 10,
                    color: COLORS.steel,
                    marginLeft: 5,
                    letterSpacing: '0.1em',
                  }}
                >
                  {code}
                </span>
              </span>

              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 11,
                  color: COLORS.muted,
                  textAlign: 'center',
                }}
              >
                {COUNTRY_LABELS[code]}
              </span>

              {/* "Click again to continue" nudge — selected card only */}
              {isSelected && (
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: COLORS.signal,
                    letterSpacing: '0.04em',
                    opacity: 0.8,
                  }}
                >
                  Click again to continue →
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 32,
          paddingRight: 80,
          position: 'relative',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onNext}
          disabled={!selected}
          aria-label={
            selected
              ? `Continue with ${COUNTRY_CONFIGS[selected as keyof typeof COUNTRY_CONFIGS]?.countryName}`
              : 'Select a country to continue'
          }
          style={{
            fontFamily: FONTS.display,
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 28px',
            borderRadius: 8,
            border: 'none',
            background: selected ? COLORS.signal : COLORS.ocean,
            color: selected ? COLORS.void : COLORS.muted,
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
