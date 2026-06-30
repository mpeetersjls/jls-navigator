/**
 * persistNativeLanguageSelection
 *
 * Called when the user SAVES the visa application form (not on every
 * keystroke/selection change — only on explicit save/submit).
 *
 * Responsibilities:
 *   - Write the chosen language to user_profiles (authenticated) or
 *     guest_native_language_prefs (guest), tagged source = 'manual'
 *     whenever the value differs from what the resolver suggested —
 *     this is what "never overwrite a user's manually selected value"
 *     means in practice: once a user explicitly confirms a value
 *     (whether they changed it or accepted the suggestion), the source
 *     is recorded as the origin of THAT confirmed value, and future
 *     resolution for this same application reads the saved value
 *     directly rather than re-running the resolver.
 *   - Log the final outcome (was the resolver's suggestion overridden?)
 *     to native_language_selection_log for analytics.
 *
 * CRITICAL RULE: this function must be the ONLY write path for
 * last_native_language. The resolver (resolveNativeLanguageDefault.ts)
 * is read-only by design — this separation is what prevents accidental
 * overwrites from background resolution calls.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { LanguageSource } from './resolveNativeLanguageDefault';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersistInput {
  /** The language the user is saving — final value, post any manual edit */
  finalLanguageCode: string;

  /** What the resolver suggested before the user interacted with the field, if anything */
  suggestedLanguageCode?: string | null;
  suggestedSource?:       LanguageSource | null;

  /** Identity — exactly one of these should be present */
  userId?:     string | null;
  guestToken?: string | null;

  /** Context for the analytics log */
  applicationId?:      string | null;
  passportCountry?:    string | null;
  nationalityCountry?: string | null;

  supabase?: SupabaseClient;
}

export interface PersistResult {
  success:       boolean;
  wasOverridden: boolean;
  error?:        string;
}

// ─── Client helper ────────────────────────────────────────────────────────────

function getClient(existing?: SupabaseClient): SupabaseClient {
  if (existing) return existing;
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Main persistence function ────────────────────────────────────────────────

export async function persistNativeLanguageSelection(
  input: PersistInput,
): Promise<PersistResult> {
  const supabase = getClient(input.supabase);

  const wasOverridden = Boolean(
    input.suggestedLanguageCode &&
    input.suggestedLanguageCode !== input.finalLanguageCode,
  );

  // The source recorded against the SAVED value. If the user changed the
  // value away from the suggestion, we record it as 'manual' — this is the
  // value that future "last used" lookups will read for this user/guest,
  // and 'manual' signals it was a deliberate choice rather than an inferred one.
  const sourceToStore: LanguageSource | 'manual' = wasOverridden
    ? 'manual'
    : (input.suggestedSource ?? 'manual');

  // ── Write to the correct identity store ───────────────────────────────────

  if (input.userId) {
    // user_profiles uses user_id as primary key (not id)
    const { error } = await supabase
      .from('user_profiles')
      .update({
        last_native_language:            input.finalLanguageCode,
        last_native_language_source:     sourceToStore,
        last_native_language_updated_at: new Date().toISOString(),
      })
      .eq('user_id', input.userId);

    if (error) {
      return { success: false, wasOverridden, error: error.message };
    }
  } else if (input.guestToken) {
    const { error } = await supabase
      .from('guest_native_language_prefs')
      .upsert({
        guest_token:   input.guestToken,
        language_code: input.finalLanguageCode,
        source:        sourceToStore,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'guest_token' });

    if (error) {
      return { success: false, wasOverridden, error: error.message };
    }
  } else {
    return {
      success: false,
      wasOverridden,
      error: 'persistNativeLanguageSelection requires either userId or guestToken',
    };
  }

  // ── Log the outcome for analytics/troubleshooting ─────────────────────────

  const { error: logError } = await supabase.from('native_language_selection_log').insert({
    user_id:             input.userId ?? null,
    guest_token:         input.guestToken ?? null,
    application_id:      input.applicationId ?? null,
    resolved_source:     wasOverridden ? 'manual_override' : (input.suggestedSource ?? 'none'),
    resolved_language:   input.suggestedLanguageCode ?? null,
    passport_country:    input.passportCountry ?? null,
    nationality_country: input.nationalityCountry ?? null,
    was_overridden:      wasOverridden,
    final_language:      input.finalLanguageCode,
  });

  if (logError) {
    // Non-fatal — the save itself succeeded, only analytics logging failed.
    console.error('[persistNativeLanguageSelection] log insert failed:', logError.message);
  }

  return { success: true, wasOverridden };
}

// ─── Guest → authenticated user migration ─────────────────────────────────────

/**
 * Call this once, immediately after a guest completes signup/login, to
 * carry their guest-token language preference over to their new
 * user_profiles row. After a successful merge, the guest row is deleted
 * so it isn't reused by a different guest who later receives the same
 * (recycled) token — tokens should be UUIDs so this is theoretical, but
 * cleanup is cheap insurance.
 */
export async function migrateGuestLanguagePref(
  guestToken: string,
  newUserId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = getClient(supabase);

  const { data: guestPref, error: fetchError } = await client
    .from('guest_native_language_prefs')
    .select('language_code, source')
    .eq('guest_token', guestToken)
    .maybeSingle();

  if (fetchError || !guestPref) return;

  // user_profiles uses user_id as primary key (not id)
  await client
    .from('user_profiles')
    .update({
      last_native_language:            guestPref.language_code,
      last_native_language_source:     guestPref.source,
      last_native_language_updated_at: new Date().toISOString(),
    })
    .eq('user_id', newUserId);

  await client
    .from('guest_native_language_prefs')
    .delete()
    .eq('guest_token', guestToken);
}
