/**
 * BoatStatusHome — ORBIT Small Boat Management.
 * "Can this boat go out today?" screen. Status is read-only, computed by
 * get_orbit_boat_status() via v_orbit_boat_home — never set manually from
 * this or any other UI. Restyled from the go-live mockup's raw hex/inline
 * styles onto this codebase's shadcn + Tailwind CSS-variable convention
 * (matches bunker-request-form.tsx etc.) rather than hardcoded colors.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, XCircle, ClipboardList, TriangleAlert } from "lucide-react";

const db = () => supabase as any;

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  green: { label: "Ready", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  amber: { label: "Attention required", className: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertTriangle },
  red: { label: "Not operational", className: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle },
};

interface BoatHome {
  boat_id: string;
  name: string;
  boat_type: string | null;
  engine_hours: number;
  hours_to_next_service: number;
  open_jobs: number;
  outstanding_defects: number;
  status: "green" | "amber" | "red";
}

export function BoatStatusHome({
  boatId,
  onBack,
  onStartChecklist,
  onReportDefect,
}: {
  boatId: string;
  onBack: () => void;
  onStartChecklist: () => void;
  onReportDefect: () => void;
}) {
  const [boat, setBoat] = useState<BoatHome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [boatId]);
  async function load() {
    setLoading(true);
    const { data } = await db().from("v_orbit_boat_home").select("*").eq("boat_id", boatId).maybeSingle();
    setBoat(data);
    setLoading(false);
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!boat) return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">Boat not found.</p>
      <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to boats</Button>
    </div>
  );

  const status = STATUS_CONFIG[boat.status] ?? STATUS_CONFIG.green;
  const StatusIcon = status.icon;

  return (
    <div className="mx-auto w-full max-w-sm space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/60">Boat</p>
          <p className="font-display text-lg font-semibold">{boat.name}</p>
        </div>
      </div>

      <div className={`rounded-2xl border p-5 text-center ${status.className}`}>
        <StatusIcon className="mx-auto mb-2 h-9 w-9" />
        <p className="text-base font-medium">{status.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Engine hours" value={boat.engine_hours.toFixed(1)} />
        <Tile label="Next service" value={`${Math.round(boat.hours_to_next_service)} hrs`} />
        <Tile label="Open jobs" value={String(boat.open_jobs)} />
        <Tile label="Defects" value={String(boat.outstanding_defects)} />
      </div>

      <Button onClick={onStartChecklist} className="h-12 w-full gap-2 rounded-2xl text-sm font-medium">
        <ClipboardList className="h-4 w-4" /> Daily checklist
      </Button>
      <Button
        onClick={onReportDefect}
        variant="outline"
        className="h-12 w-full gap-2 rounded-2xl border-red-500/30 bg-red-500/5 text-sm font-medium text-red-500 hover:bg-red-500/10 hover:text-red-500"
      >
        <TriangleAlert className="h-4 w-4" /> Report defect
      </Button>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <p className="text-[10.5px] text-muted-foreground/70">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  );
}

export default BoatStatusHome;
