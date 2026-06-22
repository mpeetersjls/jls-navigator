/**
 * POLARIS — MFA (TOTP) helpers.  Ticket #129.
 *
 * Thin wrappers over Supabase Auth's MFA API for self-service TOTP enrolment.
 *
 * IMPORTANT: enforcement is intentionally OFF for now (per build decision).
 * `getMfaGate()` reports whether a user *would* be required to enrol, but nothing
 * blocks platform access yet — flip ENFORCE_MFA to true (and wire getMfaGate into
 * a route guard) when the org is ready to make TOTP mandatory.
 */

import { supabase } from "@/integrations/supabase/client";

/** Master switch. Keep false until the org is ready to enforce. */
export const ENFORCE_MFA = false;

export interface TotpFactor {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string | null;
}

export interface EnrollResult {
  factorId: string;
  qrCodeSvg: string;   // data: URL of an SVG QR code (render directly in <img>)
  secret: string;      // manual-entry key
  uri: string;         // otpauth:// URI
}

export interface MfaStatus {
  enrolled: boolean;            // has at least one verified TOTP factor
  factors: TotpFactor[];
  /** Authenticator Assurance Level of the current session: 'aal1' | 'aal2'. */
  currentLevel: string | null;
  nextLevel: string | null;
}

/** List the current user's TOTP factors + session assurance level. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const [{ data: factorData, error: fErr }, { data: aalData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (fErr) throw new Error(fErr.message);

  const totp = (factorData?.totp ?? []) as any[];
  const factors: TotpFactor[] = totp.map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status,
    createdAt: f.created_at ?? null,
  }));
  return {
    enrolled: factors.some((f) => f.status === "verified"),
    factors,
    currentLevel: aalData?.currentLevel ?? null,
    nextLevel: aalData?.nextLevel ?? null,
  };
}

/** Begin TOTP enrolment — returns a QR code + secret for the authenticator app. */
export async function enrollTotp(friendlyName = "Authenticator"): Promise<EnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `${friendlyName} ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw new Error(error.message);
  const totp = (data as any).totp;
  return { factorId: data.id, qrCodeSvg: totp.qr_code, secret: totp.secret, uri: totp.uri };
}

/** Confirm enrolment by verifying a 6-digit code from the authenticator app. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr) throw new Error(cErr.message);
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (vErr) throw new Error(vErr.message);
  await syncProfileMfaFlag(true);
}

/** Remove a TOTP factor (cancels a half-finished enrolment or disables MFA). */
export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
  const status = await getMfaStatus();
  if (!status.enrolled) await syncProfileMfaFlag(false);
}

/**
 * Best-effort mirror of MFA state onto user_profiles.mfa_enabled (the #128 table),
 * so the access layer / admin panel can read it without an auth-admin call.
 * No-ops silently if the user has no profile row yet (rollout) or RLS blocks it.
 */
async function syncProfileMfaFlag(enabled: boolean): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    await (supabase as any).from("user_profiles").update({ mfa_enabled: enabled }).eq("user_id", uid);
  } catch {
    /* non-fatal */
  }
}

/**
 * Whether this user should be required to enrol in MFA. Reports intent only —
 * callers must check ENFORCE_MFA before actually blocking access.
 */
export async function getMfaGate(): Promise<{ required: boolean; enrolled: boolean }> {
  const status = await getMfaStatus();
  return { required: ENFORCE_MFA && !status.enrolled, enrolled: status.enrolled };
}
