/**
 * NativeLanguageField
 *
 * Drop-in container for the Visa Application form. Wires together:
 *   - Fetching the resolved default on mount (passport/last-used/nationality)
 *   - Rendering NativeLanguageSelect
 *   - Tracking whether the user has overridden the suggestion
 *   - Calling the save API when the parent form submits
 *
 * Usage in the visa application form:
 *
 *   <NativeLanguageField
 *     applicationId={application.id}
 *     passportCountry={application.passport?.issuingCountry}
 *     nationalityCountry={application.nationality}
 *     existingValue={application.nativeLanguage}     // if already saved, skip resolution entirely
 *     onSaveRef={nativeLanguageSaveRef}               // parent calls .current() on form submit
 *   />
 *
 * IMPORTANT: if `existingValue` is provided (the application already has a
 * saved native language), this component skips the resolution call entirely
 * and just renders the saved value — per the "never overwrite a manually
 * selected value" requirement. Resolution only runs for fresh applications.
 */

import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { NativeLanguageSelect, LanguageOption, DefaultSource } from './NativeLanguageSelect';
import { getOrCreateGuestToken } from '@/lib/native-language/guestToken';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NativeLanguageFieldProps {
  applicationId?:      string;
  passportCountry?:    string | null;
  nationalityCountry?: string | null;
  /** If the application already has a saved value, pass it here to skip resolution */
  existingValue?:      string | null;
  isAuthenticated?:    boolean;
  disabled?:           boolean;
  required?:           boolean;
  error?:              string;
}

export interface NativeLanguageFieldHandle {
  /** Call this when the parent form is submitted — persists the final value */
  save: () => Promise<void>;
  /** Current selected value — read this for form validation before submit */
  getValue: () => string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NativeLanguageField = forwardRef<NativeLanguageFieldHandle, NativeLanguageFieldProps>(
  function NativeLanguageField(
    {
      applicationId,
      passportCountry,
      nationalityCountry,
      existingValue,
      isAuthenticated = false,
      disabled = false,
      required = false,
      error,
    },
    ref,
  ) {
    const [languages, setLanguages]           = useState<LanguageOption[]>([]);
    const [value, setValue]                   = useState<string | null>(existingValue ?? null);
    const [defaultSource, setDefaultSource]   = useState<DefaultSource>('none');
    const [suggestedValue, setSuggestedValue] = useState<string | null>(existingValue ?? null);
    const [loading, setLoading]               = useState(!existingValue);

    const hasResolvedOnce = useRef(false);

    // ── Resolve default on mount — skip entirely if existingValue is present ──

    useEffect(() => {
      if (existingValue) {
        // Application already has a saved value — just load the language list
        // for the dropdown, no resolution needed.
        setLoading(true);
        fetch('/api/native-language/resolve-default')
          .then((r) => r.json())
          .then((data) => {
            setLanguages(data.languages ?? []);
          })
          .finally(() => setLoading(false));
        return;
      }

      if (hasResolvedOnce.current) return;
      hasResolvedOnce.current = true;

      setLoading(true);

      const guestToken = isAuthenticated ? null : getOrCreateGuestToken();

      const params = new URLSearchParams();
      if (passportCountry)    params.set('passportCountry', passportCountry);
      if (nationalityCountry) params.set('nationalityCountry', nationalityCountry);
      if (applicationId)      params.set('applicationId', applicationId);

      fetch(`/api/native-language/resolve-default?${params.toString()}`, {
        headers: guestToken ? { 'X-Guest-Token': guestToken } : undefined,
      })
        .then((r) => r.json())
        .then((data) => {
          setLanguages(data.languages ?? []);
          setValue(data.defaultLanguageCode ?? null);
          setSuggestedValue(data.defaultLanguageCode ?? null);
          setDefaultSource(data.defaultSource ?? 'none');
        })
        .catch((err) => {
          console.error('[NativeLanguageField] resolve-default failed:', err);
          // Fail gracefully — field just shows placeholder, user picks manually
        })
        .finally(() => setLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Imperative handle for parent form submit ───────────────────────────────

    useImperativeHandle(ref, () => ({
      getValue: () => value,
      save: async () => {
        if (!value) return;   // nothing to save — required validation handled by parent

        const guestToken = isAuthenticated ? null : getOrCreateGuestToken();

        await fetch('/api/native-language/save', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            finalLanguageCode:     value,
            suggestedLanguageCode: suggestedValue,
            suggestedSource:       defaultSource,
            applicationId,
            passportCountry,
            nationalityCountry,
          }),
        }).catch((err) => {
          // Non-fatal — the visa application form still saves successfully
          // even if this analytics/preference write fails.
          console.error('[NativeLanguageField] save failed:', err);
        });
      },
    }), [value, suggestedValue, defaultSource, applicationId, passportCountry, nationalityCountry, isAuthenticated]);

    const isUnmodifiedDefault = value !== null && value === suggestedValue && defaultSource !== 'none';

    return (
      <div>
        <div
          style={{
            fontFamily:   "'DINPro','Inter',sans-serif",
            fontSize:     '14px',
            fontWeight:   '500',
            color:        'rgba(255,255,255,0.85)',
            marginBottom: '8px',
          }}
        >
          Native Language
          {required && <span style={{ color: '#F87171', marginLeft: '4px' }}>*</span>}
        </div>

        <NativeLanguageSelect
          value={value}
          onChange={setValue}
          languages={languages}
          defaultSource={defaultSource}
          isUnmodifiedDefault={isUnmodifiedDefault}
          disabled={disabled || loading}
          error={error}
          required={required}
          placeholder={loading ? 'Loading…' : 'Select native language'}
        />
      </div>
    );
  },
);

export default NativeLanguageField;
