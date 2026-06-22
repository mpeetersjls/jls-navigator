/**
 * POLARIS — Organisation branding layer.  Ticket #135.
 *
 * Reads the per-organisation branding ({ displayName, logoUrl, primaryColor })
 * from organisations.branding (#128) so stakeholder landing pages can show the
 * relevant org/location context. Falls back to sensible defaults when absent.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/auth/useAccess";

export interface Branding {
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

const EMPTY: Branding = { displayName: null, logoUrl: null, primaryColor: null };

/** Branding for an org (defaults to the current user's org). */
export function useBranding(orgId?: string | null): Branding {
  const { claims } = useAccess();
  const id = orgId ?? claims.orgId;

  const { data } = useQuery({
    queryKey: ["org-branding", id],
    enabled: !!id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("organisations").select("name, branding").eq("org_id", id).maybeSingle();
      return data;
    },
  });

  if (!data) return EMPTY;
  const b = (data.branding ?? {}) as Record<string, string | undefined>;
  return {
    displayName: b.displayName ?? data.name ?? null,
    logoUrl: b.logoUrl ?? null,
    primaryColor: b.primaryColor ?? null,
  };
}
