import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { DEVELOPER_EMAILS } from "@/lib/leo-access";

// ── "View as / impersonate" preview state ─────────────────────────────────────
// Admin-only client-view preview. This is a UI preview: it re-scopes the sidebar
// nav (and shows a banner) so an admin can see the simplified layout a client/
// crew role gets. It does NOT change the user's actual identity or data access —
// true data-level impersonation needs a backend session swap + the RBAC layer.

const STORAGE_KEY = "polaris.viewAsRole";
const EVENT_KEY = "polaris:view-as-change";

export const VIEW_AS_OPTIONS = [
  { role: "vessel_owner", label: "Client (Vessel Owner)" },
  { role: "captain",      label: "Captain" },
  { role: "crew",         label: "Crew" },
] as const;

export const ROLE_LABEL: Record<string, string> = {
  vessel_owner: "Client (Vessel Owner)",
  captain: "Captain",
  crew: "Crew",
};

// Allowed top-level route prefixes per previewed role. A null result means "no
// filtering" (full admin/staff nav). Tunable as the client portal scope firms up.
const ROLE_NAV_ALLOW: Record<string, string[]> = {
  vessel_owner: ["/dashboard", "/yachts", "/my-fleet", "/crew-immigration", "/permits", "/finance", "/esign", "/guides", "/changelog"],
  captain:      ["/dashboard", "/yachts", "/my-fleet", "/crew-immigration", "/permits", "/orbit", "/packages", "/fleet-tracking", "/esign", "/guides", "/changelog"],
  crew:         ["/dashboard", "/crew-immigration", "/esign", "/guides", "/changelog"],
};

export function getViewAsRole(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setViewAsRole(role: string | null) {
  try {
    if (role) localStorage.setItem(STORAGE_KEY, role);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: role }));
}

/** Reactive hook — the currently previewed role, or null when not impersonating. */
export function useViewAsRole(): string | null {
  const [role, setRole] = useState<string | null>(() =>
    typeof window !== "undefined" ? getViewAsRole() : null,
  );
  useEffect(() => {
    const handler = (e: Event) => setRole((e as CustomEvent).detail ?? null);
    window.addEventListener(EVENT_KEY, handler);
    return () => window.removeEventListener(EVENT_KEY, handler);
  }, []);
  return role;
}

/** Allowed route prefixes for a previewed role; null = show everything. */
export function navAllowedFor(role: string | null): string[] | null {
  if (!role) return null;
  return ROLE_NAV_ALLOW[role] ?? [];
}

/** Whether the current user may use the client-view preview (admins/staff/dev). */
export function useCanImpersonate(): boolean {
  const { user } = useAuth();
  if (import.meta.env.DEV) return true;
  const email = user?.email?.toLowerCase() ?? "";
  const role: string = (user as any)?.app_metadata?.role ?? (DEVELOPER_EMAILS.includes(email) ? "global_admin" : "");
  return ["global_admin", "org_admin", "jls_staff"].includes(role);
}
