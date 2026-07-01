/**
 * DefectReportForm — ORBIT Small Boat Management.
 * Standalone defect entry point (separate from the inline
 * checklist-failure path in DailyChecklistForm). Submission always
 * creates a maintenance job in the same call via report_orbit_boat_defect
 * — there is no separate "convert to job" step. Identity derived
 * server-side; photo uploads reuse the orbit-documents bucket (private,
 * already RLS'd for authenticated read/write) under a boats/ prefix
 * rather than standing up a new bucket for this one flow.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const db = () => supabase as any;
const CATEGORIES = ["Engine", "Hull", "Electrical", "Safety equipment", "Other"];

export function DefectReportForm({
  boatId,
  onBack,
  onSubmitted,
}: {
  boatId: string;
  onBack: () => void;
  onSubmitted?: (defectId: string) => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [canOperate, setCanOperate] = useState<"yes" | "limited" | "no">("limited");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!description.trim()) { toast.error("Describe the defect"); return; }
    setSubmitting(true);

    const { data: defectId, error } = await db().rpc("report_orbit_boat_defect", {
      p_boat_id: boatId,
      p_category: category,
      p_description: description.trim(),
      p_urgency: urgency,
      p_can_operate: canOperate,
      p_source_checklist_id: null,
    });

    if (error) { toast.error(error.message); setSubmitting(false); return; }

    if (photoFile) {
      const path = `boats/defects/${defectId}-${photoFile.name}`;
      const { error: upErr } = await db().storage.from("orbit-documents").upload(path, photoFile);
      if (!upErr) await db().from("orbit_boat_defect_photos").insert({ defect_id: defectId, file_path: path });
    }

    setSubmitting(false);
    setDone(true);
    onSubmitted?.(defectId);
  }

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-base font-medium">Defect reported</p>
        <p className="text-sm text-muted-foreground">A maintenance job has been created and the manager notified.</p>
        <Button variant="outline" className="mt-2" onClick={onBack}>Back to boat</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <p className="font-display text-base font-semibold">Report defect</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Category</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the defect"
        rows={3}
        className="resize-none text-sm"
      />

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Urgency</p>
        <div className="flex gap-1.5">
          {(["low", "normal", "high", "critical"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUrgency(u)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-medium capitalize",
                urgency === u ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Can boat operate?</p>
        <div className="flex gap-1.5">
          {(["yes", "limited", "no"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setCanOperate(v)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-medium capitalize",
                canOperate === v ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground">
        <Upload className="h-4 w-4" /> {photoFile ? photoFile.name : "Take or upload photo"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
      </label>

      <Button
        onClick={handleSubmit}
        disabled={submitting || !description.trim()}
        variant="destructive"
        className="h-12 w-full gap-1.5 rounded-2xl text-sm font-medium"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? "Submitting…" : "Submit"}
      </Button>
    </div>
  );
}

export default DefectReportForm;
