import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wifi, Plus, Pencil, Trash2, Loader2, Search, Monitor,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type YachtItContract = {
  id: string;
  yacht_name: string;
  service_name: string;
  vendor: string | null;
  category: string;
  charge_amount: number | null;
  cost_amount: number | null;
  billing_cycle: string;
  start_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = Omit<YachtItContract, "id" | "created_at" | "updated_at">;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "connectivity", label: "Connectivity" },
  { value: "security", label: "Security" },
  { value: "support", label: "Support" },
  { value: "other", label: "Other" },
];

const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "one_off", label: "One-off" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_FORM: FormState = {
  yacht_name: "",
  service_name: "",
  vendor: null,
  category: "other",
  charge_amount: null,
  cost_amount: null,
  billing_cycle: "monthly",
  start_date: null,
  expiry_date: null,
  status: "active",
  notes: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAed(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Resolve effective status accounting for expiry date proximity */
function effectiveStatus(contract: YachtItContract): string {
  if (contract.status !== "active") return contract.status;
  const days = daysUntil(contract.expiry_date);
  if (days !== null && days >= 0 && days <= 30) return "expiring_soon";
  if (days !== null && days < 0) return "expired";
  return "active";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    expiring_soon: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    expired: "bg-red-500/15 text-red-400 border-red-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  const label: Record<string, string> = {
    active: "Active",
    expiring_soon: "Expiring Soon",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? map.cancelled}`}>
      {label[status] ?? status}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    software: "bg-blue-500/15 text-blue-400",
    hardware: "bg-purple-500/15 text-purple-400",
    connectivity: "bg-sky-500/15 text-sky-400",
    security: "bg-orange-500/15 text-orange-400",
    support: "bg-green-500/15 text-green-400",
    other: "bg-muted text-muted-foreground",
  };
  const label = CATEGORIES.find(c => c.value === category)?.label ?? category;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${map[category] ?? map.other}`}>
      {label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function YachtItPage() {
  const [contracts, setContracts] = useState<YachtItContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<YachtItContract | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<YachtItContract | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("yacht_it_contracts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setContracts((data ?? []) as YachtItContract[]);
    setLoading(false);
  }

  // Apply effective status to all contracts for display/filtering
  const contractsWithStatus = useMemo(
    () => contracts.map(c => ({ ...c, _effectiveStatus: effectiveStatus(c) })),
    [contracts],
  );

  const filtered = useMemo(() => {
    let list = contractsWithStatus;
    if (statusFilter !== "all") list = list.filter(c => c._effectiveStatus === statusFilter);
    if (categoryFilter !== "all") list = list.filter(c => c.category === categoryFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.yacht_name.toLowerCase().includes(s) ||
        c.service_name.toLowerCase().includes(s) ||
        (c.vendor ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [contractsWithStatus, statusFilter, categoryFilter, search]);

  const stats = useMemo(() => {
    const all = contractsWithStatus;
    return {
      total: all.length,
      active: all.filter(c => c._effectiveStatus === "active").length,
      expiringSoon: all.filter(c => c._effectiveStatus === "expiring_soon").length,
      expired: all.filter(c => c._effectiveStatus === "expired").length,
    };
  }, [contractsWithStatus]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(c: YachtItContract) {
    setEditing(c);
    const { id, created_at, updated_at, ...rest } = c;
    setForm(rest);
    setOpen(true);
  }

  function setF<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.yacht_name.trim()) { toast.error("Yacht name is required"); return; }
    if (!form.service_name.trim()) { toast.error("Service name is required"); return; }
    setBusy(true);
    try {
      const payload = {
        yacht_name: form.yacht_name.trim(),
        service_name: form.service_name.trim(),
        vendor: form.vendor?.trim() || null,
        category: form.category,
        charge_amount: form.charge_amount,
        cost_amount: form.cost_amount,
        billing_cycle: form.billing_cycle,
        start_date: form.start_date || null,
        expiry_date: form.expiry_date || null,
        status: form.status,
        notes: form.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("yacht_it_contracts")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Contract updated");
      } else {
        const { error } = await (supabase as any)
          .from("yacht_it_contracts")
          .insert([payload]);
        if (error) throw error;
        toast.success("Contract added");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await (supabase as any)
      .from("yacht_it_contracts")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success("Contract deleted"); await load(); }
    setDeleteTarget(null);
  }

  const hasFilters = statusFilter !== "all" || categoryFilter !== "all" || search.trim() !== "";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/40 px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Yacht IT Solutions</div>
            <h1 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Client Services &amp; Subscriptions
            </h1>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Contract
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Contracts", value: stats.total, color: "text-primary" },
            { label: "Active", value: stats.active, color: "text-emerald-400" },
            { label: "Expiring Soon", value: stats.expiringSoon, color: "text-amber-400" },
            { label: "Expired", value: stats.expired, color: "text-red-400" },
          ].map(s => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5"
            >
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className={`font-display text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={() => { setStatusFilter("all"); setCategoryFilter("all"); setSearch(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contracts…"
              className="h-7 w-56 pl-8 text-xs"
            />
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Wifi className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {hasFilters ? "No contracts match your filters." : "No contracts yet. Add your first IT contract."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  {["Yacht", "Service", "Vendor", "Category", "Charge (AED)", "Cost (AED)", "Profit (AED)", "Billing", "Start", "Expiry", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const profit =
                    c.charge_amount != null && c.cost_amount != null
                      ? c.charge_amount - c.cost_amount
                      : null;
                  const days = daysUntil(c.expiry_date);
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-accent/20 transition group">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{c.yacht_name}</td>
                      <td className="px-3 py-2">{c.service_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.vendor ?? "—"}</td>
                      <td className="px-3 py-2"><CategoryBadge category={c.category} /></td>
                      <td className="px-3 py-2 tabular-nums text-right">{fmtAed(c.charge_amount)}</td>
                      <td className="px-3 py-2 tabular-nums text-right">{fmtAed(c.cost_amount)}</td>
                      <td className={`px-3 py-2 tabular-nums text-right font-medium ${
                        profit != null && profit > 0 ? "text-emerald-400" : profit != null && profit < 0 ? "text-red-400" : ""
                      }`}>
                        {fmtAed(profit)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {BILLING_CYCLES.find(b => b.value === c.billing_cycle)?.label ?? c.billing_cycle}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">{fmtDate(c.start_date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {c.expiry_date ? (
                          <span className={
                            days !== null && days < 0 ? "text-red-400" :
                            days !== null && days <= 30 ? "text-amber-400" :
                            "text-muted-foreground"
                          }>
                            {fmtDate(c.expiry_date)}
                            {days !== null && days >= 0 && days <= 30 && (
                              <span className="ml-1 text-[10px]">({days}d)</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={c._effectiveStatus} /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition justify-end">
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded p-1 hover:bg-muted transition"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="rounded p-1 hover:bg-destructive/10 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              {editing ? `Edit — ${editing.service_name}` : "Add IT Contract"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Yacht Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.yacht_name}
                  onChange={e => setF("yacht_name", e.target.value)}
                  placeholder="e.g. MY STARGAZER"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Service Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.service_name}
                  onChange={e => setF("service_name", e.target.value)}
                  placeholder="e.g. Starlink Maritime"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Input
                  value={form.vendor ?? ""}
                  onChange={e => setF("vendor", e.target.value || null)}
                  placeholder="e.g. SpaceX"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setF("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Charge to Customer (AED)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.charge_amount ?? ""}
                  onChange={e => setF("charge_amount", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Our Cost (AED)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_amount ?? ""}
                  onChange={e => setF("cost_amount", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <Select value={form.billing_cycle} onValueChange={v => setF("billing_cycle", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setF("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date ?? ""}
                  onChange={e => setF("start_date", e.target.value || null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date ?? ""}
                  onChange={e => setF("expiry_date", e.target.value || null)}
                />
              </div>
            </div>

            {/* Profit preview */}
            {(form.charge_amount != null || form.cost_amount != null) && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Profit margin</span>
                <span className={`font-semibold tabular-nums ${
                  (form.charge_amount ?? 0) - (form.cost_amount ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  AED {fmtAed((form.charge_amount ?? 0) - (form.cost_amount ?? 0))}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={e => setF("notes", e.target.value || null)}
                placeholder="Any additional notes…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleSave} disabled={busy} className="gap-1.5">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Add Contract"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contract?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.service_name}</strong> for{" "}
              <strong>{deleteTarget?.yacht_name}</strong> will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
