/**
 * DailyChecklistForm — ORBIT Small Boat Management.
 * Implements the FRS automation chain inline: failing an item offers
 * "Create defect?" right there, calling report_orbit_boat_defect
 * immediately rather than routing to a separate screen. Identity is
 * derived server-side (auth.uid()) — no submittedBy prop needed.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const db = () => supabase as any;

interface ChecklistItem {
  id: string;
  code: string;
  label: string;
  applies_to_trailer_only: boolean;
}

export function DailyChecklistForm({
  boatId,
  hasTrailer,
  onBack,
  onSubmitted,
}: {
  boatId: string;
  hasTrailer: boolean;
  onBack: () => void;
  onSubmitted?: () => void;
}) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [responses, setResponses] = useState<Record<string, { passed: boolean; notes: string }>>({});
  const [comments, setComments] = useState("");
  const [readyForUse, setReadyForUse] = useState<"yes" | "limited" | "no">("yes");
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { void load(); }, [hasTrailer]);
  async function load() {
    setLoading(true);
    const { data } = await db()
      .from("orbit_boat_checklist_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    const filtered = (data ?? []).filter((i: ChecklistItem) => !i.applies_to_trailer_only || hasTrailer);
    setItems(filtered);
    setResponses(Object.fromEntries(filtered.map((i: ChecklistItem) => [i.code, { passed: true, notes: "" }])));
    setLoading(false);
  }

  function toggleItem(code: string, passed: boolean) {
    setResponses((r) => ({ ...r, [code]: { ...r[code], passed } }));
  }

  async function handleCreateDefect(code: string, label: string) {
    const { data: defectId, error } = await db().rpc("report_orbit_boat_defect", {
      p_boat_id: boatId,
      p_category: "checklist_failure",
      p_description: `${label} failed daily checklist`,
      p_urgency: "normal",
      p_can_operate: readyForUse,
      p_source_checklist_id: checklistId,
    });
    if (error) { toast.error(error.message); return; }
    setResponses((r) => ({ ...r, [code]: { ...r[code], notes: `Defect created` } }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const responsesArray = Object.entries(responses).map(([code, v]) => ({ code, passed: v.passed, notes: v.notes }));

    const { data: id, error } = await db().rpc("save_orbit_boat_daily_checklist", {
      p_boat_id: boatId,
      p_checklist_date: new Date().toISOString().slice(0, 10),
      p_responses: responsesArray,
      p_comments: comments,
      p_photo_path: null,
      p_ready_for_use: readyForUse,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    setChecklistId(id);
    const { error: submitError } = await db().rpc("submit_orbit_boat_daily_checklist", { p_checklist_id: id });
    setSubmitting(false);
    if (submitError) { toast.error(submitError.message); return; }
    toast.success("Checklist submitted");
    onSubmitted?.();
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <p className="font-display text-base font-semibold">Daily checklist</p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => {
            const r = responses[item.code];
            const failed = r && !r.passed;
            return (
              <div key={item.id}>
                <button
                  onClick={() => toggleItem(item.code, !r?.passed)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm",
                    failed ? "bg-red-500/10 text-red-500" : "bg-muted/50 text-foreground"
                  )}
                >
                  <span>{item.label}</span>
                  {failed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </button>
                {failed && !r.notes?.startsWith("Defect created") && (
                  <div className="mt-1 rounded-xl bg-red-500/5 p-3">
                    <p className="mb-2 text-xs font-medium text-red-500">{item.label} failed — create defect?</p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9 w-full text-xs"
                      onClick={() => handleCreateDefect(item.code, item.label)}
                    >
                      Report defect
                    </Button>
                  </div>
                )}
                {r?.notes?.startsWith("Defect created") && (
                  <p className="mt-1 px-3 text-xs text-muted-foreground">{r.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Comments (optional)"
        rows={2}
        className="resize-none text-sm"
      />

      <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
        <span className="text-sm font-medium">Ready for use?</span>
        <div className="flex gap-1.5">
          {(["yes", "limited", "no"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setReadyForUse(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize",
                readyForUse === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={submitting || loading} className="h-12 w-full gap-1.5 rounded-2xl text-sm font-medium">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? "Submitting…" : "Submit checklist"}
      </Button>
    </div>
  );
}

export default DailyChecklistForm;
