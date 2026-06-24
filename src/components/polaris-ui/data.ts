/**
 * Polaris Redesign — shared data hook for the preview screens (#195).
 * Reads live yacht/crew/visa data via the browser Supabase client (RLS-scoped),
 * and classifies each crew member with the shared visa-status logic. Vessel-scoped:
 * every query filters by yacht_id (spec rule #6).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getVisaStatus,
  type VisaStatus,
} from "@/lib/visa-reporting/statusHelpers";

export interface YachtOption {
  id: string;
  vessel_name: string | null;
  send_visa_reports: boolean | null;
  visa_report_email: string | null;
}

export interface CrewVisaRow {
  crewId: string;
  name: string;
  rank: string | null;
  nationality: string | null;
  visaType: string | null;
  expiry: string | null;
  status: VisaStatus;
  daysRemaining: number | null;
  daysOverdue: number | null;
}

export interface VesselVisaData {
  loading: boolean;
  rows: CrewVisaRow[];
  counts: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    noVisa: number;
  };
}

export function useYachts(): { yachts: YachtOption[]; loading: boolean } {
  const [yachts, setYachts] = useState<YachtOption[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any)
        .from("yachts")
        .select("id, vessel_name, send_visa_reports, visa_report_email")
        .order("vessel_name", { ascending: true });
      setYachts((data ?? []) as YachtOption[]);
      setLoading(false);
    })();
  }, []);
  return { yachts, loading };
}

const EXCLUDED = new Set(["cancelled", "sign off", "signed off"]);

export function useVesselVisaData(
  yachtId: string | null,
): VesselVisaData & { reload: () => void } {
  const [state, setState] = useState<VesselVisaData>({
    loading: true,
    rows: [],
    counts: { total: 0, active: 0, expiring: 0, expired: 0, noVisa: 0 },
  });

  const load = useCallback(async () => {
    if (!yachtId) return;
    setState((s) => ({ ...s, loading: true }));

    const [{ data: crew }, { data: visas }] = await Promise.all([
      (supabase as any)
        .from("crew_members")
        .select("id, full_name, rank, status, nationality")
        .eq("yacht_id", yachtId),
      (supabase as any)
        .from("visa_applications")
        .select("crew_member_id, visa_type, visa_expiry, status")
        .eq("yacht_id", yachtId)
        .eq("status", "approved"),
    ]);

    // latest approved visa per crew member (by expiry desc)
    const byCrew = new Map<
      string,
      { visa_type: string | null; visa_expiry: string | null }
    >();
    for (const v of (visas ?? []) as any[]) {
      const prev = byCrew.get(v.crew_member_id);
      if (!prev || (v.visa_expiry ?? "") > (prev.visa_expiry ?? ""))
        byCrew.set(v.crew_member_id, {
          visa_type: v.visa_type,
          visa_expiry: v.visa_expiry,
        });
    }

    const rows: CrewVisaRow[] = ((crew ?? []) as any[])
      .filter((c) => !EXCLUDED.has(String(c.status ?? "").toLowerCase()))
      .map((c) => {
        const v = byCrew.get(c.id);
        const st = getVisaStatus(v?.visa_expiry ?? null);
        return {
          crewId: c.id,
          name: c.full_name ?? "—",
          rank: c.rank ?? null,
          nationality: c.nationality ?? null,
          visaType: v?.visa_type ?? null,
          expiry: v?.visa_expiry ?? null,
          status: st.status,
          daysRemaining: st.daysRemaining,
          daysOverdue: st.daysOverdue,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const counts = {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      expiring: rows.filter((r) => r.status === "expiring_soon").length,
      expired: rows.filter((r) => r.status === "expired").length,
      noVisa: rows.filter((r) => r.status === "no_visa").length,
    };

    setState({ loading: false, rows, counts });
  }, [yachtId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: () => void load() };
}
