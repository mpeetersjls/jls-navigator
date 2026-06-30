/**
 * guestToken
 *
 * Client-side utility for generating and reading the guest token used by
 * Tier 2 (last-used) resolution for unauthenticated users. The token is a
 * UUID stored in a long-lived cookie — NOT localStorage, so it survives
 * across the guest's session even if they clear site data selectively,
 * and so it's readable server-side on initial page load without a
 * client round-trip.
 *
 * Usage (client component):
 *   const token = getOrCreateGuestToken();
 *   // pass token as guestToken to the resolver / persistence calls
 */

const COOKIE_NAME    = 'polaris_guest_lang_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;   // 1 year

function generateUuid(): string {
  // Use crypto.randomUUID if available (all modern browsers + Node 16+)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback — RFC4122-ish, sufficient for a non-security-critical cookie token
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;   // SSR guard
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;   // SSR guard
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

/**
 * Returns the existing guest token if present, otherwise creates and
 * persists a new one. Safe to call on every page load — it's a no-op
 * after the first call per browser.
 */
export function getOrCreateGuestToken(): string {
  const existing = readCookie(COOKIE_NAME);
  if (existing) return existing;

  const token = generateUuid();
  writeCookie(COOKIE_NAME, token, COOKIE_MAX_AGE);
  return token;
}

/**
 * Reads the guest token without creating one. Used server-side in API
 * routes where we don't want to set cookies from within a GET handler.
 */
export function readGuestToken(): string | null {
  return readCookie(COOKIE_NAME);
}

/**
 * Call after successful signup/login to clear the guest token cookie —
 * the preference has been migrated into the user's profile by
 * migrateGuestLanguagePref(), so the cookie is no longer needed.
 */
export function clearGuestToken(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}
