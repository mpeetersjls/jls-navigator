/**
 * useAccess — React hook exposing the current user's POLARIS claims.
 *
 * Wraps deriveClaims() in react-query so the derived claims are cached per user
 * and shared across the app (sidebar, route guards, dashboards). This is the
 * client-side stand-in for JWT custom claims (#130) while Edge Functions are off.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  deriveClaims, ANON_CLAIMS, type PolarisClaims,
  canAccessModule, hasVesselAccess, getLandingPath, resolveLandingPath,
  type PermissionLevel,
} from "@/lib/auth/claims";

export interface UseAccessResult {
  claims: PolarisClaims;
  loading: boolean;
  isGlobalAdmin: boolean;
  canAccessModule: (moduleName: string, required?: PermissionLevel) => boolean;
  hasVesselAccess: (vesselId: string) => boolean;
  landingPath: string;
  refetch: () => void;
}

export function useAccess(): UseAccessResult {
  const { user, loading: authLoading } = useAuth();

  const { data: claims = ANON_CLAIMS, isLoading, refetch } = useQuery({
    queryKey: ["polaris-claims", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: () => deriveClaims(supabase, user!),
  });

  return {
    claims,
    loading: authLoading || (!!user && isLoading),
    isGlobalAdmin: claims.isGlobalAdmin,
    canAccessModule: (m, required) => canAccessModule(claims, m, required),
    hasVesselAccess: (v) => hasVesselAccess(claims, v),
    landingPath: resolveLandingPath(claims),
    refetch,
  };
}

export { getLandingPath, resolveLandingPath };
export type { PolarisClaims, PermissionLevel };
