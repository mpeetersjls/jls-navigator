/**
 * POST /api/native-language/save
 *
 * Called when the user SAVES the Visa Application form (explicit submit,
 * not on every dropdown change). Persists the final language choice and
 * records whether it overrode the system's suggestion.
 *
 * Body:
 *   {
 *     finalLanguageCode:     string,            // required
 *     suggestedLanguageCode?: string | null,    // what the resolver returned on load
 *     suggestedSource?:       'passport' | 'last_used' | 'nationality' | 'none' | null,
 *     applicationId?:         string,
 *     passportCountry?:       string,
 *     nationalityCountry?:    string,
 *   }
 *
 * Auth: reads Bearer token if present, falls back to X-Guest-Token header.
 */

import { createClient } from '@supabase/supabase-js'
import { persistNativeLanguageSelection } from '@/lib/native-language/persistNativeLanguageSelection'

function getAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('Supabase admin credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function nativeLanguageSaveHandler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    finalLanguageCode,
    suggestedLanguageCode,
    suggestedSource,
    applicationId,
    passportCountry,
    nationalityCountry,
  } = body as Record<string, string | null | undefined>

  if (!finalLanguageCode || typeof finalLanguageCode !== 'string') {
    return Response.json(
      { error: 'finalLanguageCode is required and must be a string' },
      { status: 400 },
    )
  }

  const supabase   = getAdmin()
  const guestToken = request.headers.get('X-Guest-Token')

  // Resolve authenticated session from Bearer token, if present
  let userId: string | null = null
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data } = await supabase.auth.getUser(token)
    userId = data.user?.id ?? null
  }

  if (!userId && !guestToken) {
    return Response.json(
      { error: 'No authenticated session and no guest token present — cannot persist selection' },
      { status: 400 },
    )
  }

  try {
    const result = await persistNativeLanguageSelection({
      finalLanguageCode,
      suggestedLanguageCode: suggestedLanguageCode ?? null,
      suggestedSource:       (suggestedSource as any) ?? null,
      userId,
      guestToken,
      applicationId:      applicationId ?? null,
      passportCountry:    passportCountry ?? null,
      nationalityCountry: nationalityCountry ?? null,
      supabase,
    })

    if (!result.success) {
      return Response.json(
        { error: 'Failed to persist selection', detail: result.error },
        { status: 500 },
      )
    }

    return Response.json({ success: true, wasOverridden: result.wasOverridden })
  } catch (err: unknown) {
    console.error('[POST /api/native-language/save] unexpected error:', err)
    return Response.json(
      { error: 'Unexpected error saving native language selection' },
      { status: 500 },
    )
  }
}
