/**
 * QuickBooks OAuth connect flow (no manual refresh token needed).
 *   GET /api/qb/connect   -> redirects to Intuit's authorize screen (the "Connect/Reconnect URL")
 *   GET /api/qb/callback  -> Intuit redirects back here with a code; we exchange it for tokens
 *                            and store them in qbo_tokens (this is the app's Redirect URI)
 *
 * Register this Redirect URI in the Intuit app (Keys & credentials → Redirect URIs):
 *   https://<app-domain>/api/qb/callback
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const SCOPE = 'com.intuit.quickbooks.accounting'

function redirectUri(url: URL): string {
  return process.env.QBO_REDIRECT_URI ?? `${url.origin}/api/qb/callback`
}

/** Start the OAuth handshake. */
export async function qbConnectHandler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const clientId = process.env.QBO_CLIENT_ID
  if (!clientId) return new Response('QuickBooks is not configured (QBO_CLIENT_ID missing).', { status: 503 })

  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: SCOPE,
    redirect_uri: redirectUri(url),
    state,
  })
  const headers = new Headers({ Location: `${AUTH_URL}?${params.toString()}` })
  headers.append('Set-Cookie', `qbo_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  return new Response(null, { status: 302, headers })
}

/** Handle Intuit's redirect: exchange the code for tokens and persist them. */
export async function qbCallbackHandler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')
  const state = url.searchParams.get('state')

  const cookie = request.headers.get('cookie') ?? ''
  const expected = /qbo_oauth_state=([^;]+)/.exec(cookie)?.[1]
  if (!code || !realmId) return new Response('Missing authorization code or realmId.', { status: 400 })
  if (!state || !expected || state !== expected) return new Response('Invalid OAuth state.', { status: 400 })

  const basic = btoa(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri(url))}`,
  })
  if (!res.ok) {
    return new Response(`QuickBooks token exchange failed (${res.status}): ${await res.text().catch(() => '')}`, { status: 502 })
  }
  const j: any = await res.json()
  const now = Date.now()
  const sb = supabaseAdmin as any
  await sb.from('qbo_tokens').upsert({
    realm_id: realmId,
    access_token: j.access_token,
    access_expires_at: new Date(now + (j.expires_in ?? 3600) * 1000).toISOString(),
    refresh_token: j.refresh_token,
    refresh_expires_at: new Date(now + (j.x_refresh_token_expires_in ?? 8726400) * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  }, { onConflict: 'realm_id' })

  const headers = new Headers({ Location: `/legal/quickbooks-connected?realm=${encodeURIComponent(realmId)}` })
  headers.append('Set-Cookie', 'qbo_oauth_state=; Path=/; Max-Age=0')
  return new Response(null, { status: 302, headers })
}
