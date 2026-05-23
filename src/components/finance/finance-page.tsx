import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, RefreshCw, CheckCircle2, XCircle, FileText, FileCheck,
  Quote, Loader2, ExternalLink, ClipboardList, Search, Check, AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type FinanceTab = "invoices" | "proforma" | "quotations" | "tracker";

type BillingStatus = "pending_review" | "pending_invoice" | "invoiced" | "not_billable";

type TrackerTrip = {
  id: string;
  trip_type: string;
  pickup_datetime: string | null;
  passenger_name: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  notes: string | null;
  status: string;
  billing_status: BillingStatus;
  invoice_ref: string | null;
  invoice_amount: number | null;
  driver?: { full_name: string } | null;
  yacht?: { vessel_name: string } | null;
};

const BILLING_LABEL: Record<BillingStatus, string> = {
  pending_review: "Pending Review",
  pending_invoice: "Needs Invoice",
  invoiced: "Invoiced",
  not_billable: "Not Billable",
};

const BILLING_COLOR: Record<BillingStatus, string> = {
  pending_review: "bg-muted/60 text-muted-foreground border-border",
  pending_invoice: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  invoiced: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  not_billable: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const TRIP_TYPE_LABEL: Record<string, string> = {
  arrival_transport: "Arrival Transport",
  departure_transport: "Departure Transport",
  crew_pickup: "Crew Pickup",
  inhouse: "In-House",
  airport_transfer: "Airport Transfer",
  delivery_collection: "Delivery & Collection",
  seaport_crew_change: "Seaport Crew Change",
  shorebased: "Shorebased",
};

// ─── Invoice Tracker ──────────────────────────────────────────────────────────

function InvoiceTracker() {
  const [trips, setTrips] = useState<TrackerTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterYacht, setFilterYacht] = useState("all");
  const [filterBilling, setFilterBilling] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editInvoiceRef, setEditInvoiceRef] = useState("");
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("crew_trips")
      .select("id, trip_type, pickup_datetime, passenger_name, pickup_address, dropoff_address, notes, status, billing_status, invoice_ref, invoice_amount, driver:crew_drivers(full_name), yacht:yachts(vessel_name)")
      .order("pickup_datetime", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setTrips((data ?? []) as TrackerTrip[]);
    setLoading(false);
  }

  const yachts = useMemo(() => {
    const names = new Set<string>();
    trips.forEach(t => { if (t.yacht?.vessel_name) names.add(t.yacht.vessel_name); });
    return Array.from(names).sort();
  }, [trips]);

  const filtered = useMemo(() => trips.filter(t => {
    if (filterYacht !== "all" && t.yacht?.vessel_name !== filterYacht) return false;
    if (filterBilling !== "all" && t.billing_status !== filterBilling) return false;
    if (filterType !== "all" && t.trip_type !== filterType) return false;
    if (q.trim()) {
      const qq = q.toLowerCase();
      const hay = [
        t.passenger_name, t.pickup_address, t.dropoff_address,
        t.yacht?.vessel_name, t.driver?.full_name, t.invoice_ref, t.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(qq)) return false;
    }
    return true;
  }), [trips, filterYacht, filterBilling, filterType, q]);

  const stats = useMemo(() => ({
    total: trips.length,
    needs_invoice: trips.filter(t => t.billing_status === "pending_invoice").length,
    invoiced: trips.filter(t => t.billing_status === "invoiced").length,
    pending_review: trips.filter(t => t.billing_status === "pending_review").length,
    total_invoiced: trips.filter(t => t.billing_status === "invoiced" && t.invoice_amount)
      .reduce((s, t) => s + (t.invoice_amount ?? 0), 0),
  }), [trips]);

  async function updateBilling(id: string, billing_status: BillingStatus, invoice_ref?: string, invoice_amount?: number | null) {
    setSaving(id);
    const patch: any = { billing_status };
    if (invoice_ref !== undefined) patch.invoice_ref = invoice_ref || null;
    if (invoice_amount !== undefined) patch.invoice_amount = invoice_amount;
    const { error } = await (supabase as any).from("crew_trips").update(patch).eq("id", id);
    if (error) { toast.error(error.message); setSaving(null); return; }
    setTrips(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    setEditingRow(null);
    setSaving(null);
    toast.success("Updated");
  }

  function startEdit(trip: TrackerTrip) {
    setEditingRow(trip.id);
    setEditInvoiceRef(trip.invoice_ref ?? "");
    setEditAmount(trip.invoice_amount ? String(trip.invoice_amount) : "");
  }

  function fmtDate(dt: string | null) {
    if (!dt) return "—";
    return new Date(dt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtAed(n: number | null) {
    if (!n) return "—";
    return `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Trips", value: stats.total, color: "text-foreground" },
          { label: "Pending Review", value: stats.pending_review, color: "text-muted-foreground" },
          { label: "Needs Invoice", value: stats.needs_invoice, color: "text-amber-400" },
          { label: "Invoiced", value: stats.invoiced, color: "text-emerald-400" },
          { label: "Total Invoiced", value: `AED ${stats.total_invoiced.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search trips…" className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filterYacht} onValueChange={setFilterYacht}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All yachts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Yachts</SelectItem>
            {yachts.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBilling} onValueChange={setFilterBilling}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Billing</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="pending_invoice">Needs Invoice</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="not_billable">Not Billable</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TRIP_TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {(q || filterYacht !== "all" || filterBilling !== "all" || filterType !== "all") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => { setQ(""); setFilterYacht("all"); setFilterBilling("all"); setFilterType("all"); }}>
            <RotateCcw className="h-3 w-3" /> Clear
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 ml-auto" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {["Date", "Type", "Yacht", "Driver", "Pickup → Dropoff", "Notes", "Billing Status", "Invoice Ref", "Amount (AED)", "Actions"].map(col => (
                  <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">No trips match the current filters.</td></tr>
              ) : filtered.map(trip => {
                const isEditing = editingRow === trip.id;
                const isSaving = saving === trip.id;
                const bs = (trip.billing_status ?? "pending_review") as BillingStatus;
                return (
                  <tr key={trip.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{fmtDate(trip.pickup_datetime)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{TRIP_TYPE_LABEL[trip.trip_type] ?? trip.trip_type}</td>
                    <td className="px-3 py-2 text-xs font-medium whitespace-nowrap">{trip.yacht?.vessel_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{trip.driver?.full_name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs max-w-[200px]">
                      <div className="truncate text-muted-foreground">{[trip.pickup_address, trip.dropoff_address].filter(Boolean).join(" → ") || "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[150px]">
                      <div className="truncate text-muted-foreground">{trip.notes ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide ${BILLING_COLOR[bs]}`}>
                        {BILLING_LABEL[bs]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editInvoiceRef}
                          onChange={e => setEditInvoiceRef(e.target.value)}
                          placeholder="INV-001"
                          className="h-6 w-24 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        <span className="text-muted-foreground">{trip.invoice_ref ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {isEditing ? (
                        <input
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          className="h-6 w-20 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        <span className="text-muted-foreground">{fmtAed(trip.invoice_amount)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateBilling(trip.id, "invoiced", editInvoiceRef, editAmount ? parseFloat(editAmount) : null)}
                            disabled={isSaving}
                            className="rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            {isSaving ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingRow(null)} className="rounded bg-muted/60 text-muted-foreground hover:bg-muted px-1.5 py-0.5 text-[10px]">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          {bs === "pending_review" && (
                            <button
                              onClick={() => updateBilling(trip.id, "pending_invoice")}
                              disabled={isSaving}
                              title="Mark as Needs Invoice"
                              className="rounded p-1 text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 transition"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {bs !== "invoiced" && bs !== "not_billable" && (
                            <button
                              onClick={() => startEdit(trip)}
                              disabled={isSaving}
                              title="Mark as Invoiced"
                              className="rounded p-1 text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {bs !== "not_billable" && (
                            <button
                              onClick={() => updateBilling(trip.id, "not_billable")}
                              disabled={isSaving}
                              title="Mark as Not Billable"
                              className="rounded p-1 text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/40 transition"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {bs !== "pending_review" && (
                            <button
                              onClick={() => updateBilling(trip.id, "pending_review")}
                              disabled={isSaving}
                              title="Reset to Pending Review"
                              className="rounded p-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {trips.length} trips
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>("tracker");
  const [connected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (!connected) { toast.error("Connect QuickBooks first"); return; }
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1000));
    setSyncing(false);
    toast.success("Sync complete");
  }

  const QB_TABS: { key: Exclude<FinanceTab, "tracker">; label: string; icon: React.ComponentType<{ className?: string }>; cols: string[] }[] = [
    { key: "invoices", label: "Invoices", icon: FileText, cols: ["#", "Customer / Vessel", "Date", "Due Date", "Amount", "Status"] },
    { key: "proforma", label: "Pro-Forma", icon: FileCheck, cols: ["#", "Customer / Vessel", "Date", "Expiry", "Amount", "Status"] },
    { key: "quotations", label: "Quotations", icon: Quote, cols: ["#", "Customer / Vessel", "Date", "Valid Until", "Amount", "Status"] },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card/40 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Finance</div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Finance</h1>
        </div>
        {tab !== "tracker" && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync from QuickBooks
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* QuickBooks connection card — only show for QB tabs */}
        {tab !== "tracker" && (
          <div className="rounded-lg border border-border bg-card/60 p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2CA01C]/10">
                <DollarSign className="h-5 w-5 text-[#2CA01C]" />
              </div>
              <div>
                <p className="text-sm font-semibold">QuickBooks Online</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {connected
                    ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">Connected</span></>
                    : <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Not connected</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connected && (
                <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={() => toast.info("Opening QuickBooks…")}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open QuickBooks
                </Button>
              )}
              <Button size="sm" variant={connected ? "outline" : "default"} className="h-7 text-xs"
                onClick={() => toast.info("QuickBooks OAuth integration — coming soon")}>
                {connected ? "Reconnect" : "Connect QuickBooks"}
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            onClick={() => setTab("tracker")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === "tracker" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Invoice Tracker
          </button>
          {QB_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "tracker" ? (
          <InvoiceTracker />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {QB_TABS.find(t => t.key === tab)!.cols.map(col => (
                    <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={QB_TABS.find(t => t.key === tab)!.cols.length} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {(() => { const Icon = QB_TABS.find(t => t.key === tab)!.icon; return <Icon className="h-8 w-8 opacity-30" />; })()}
                      <p className="text-sm">No {QB_TABS.find(t => t.key === tab)!.label.toLowerCase()} yet.</p>
                      <p className="text-xs opacity-70">Connect QuickBooks and sync to import records.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
