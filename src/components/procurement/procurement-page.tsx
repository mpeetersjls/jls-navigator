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
  ShoppingCart, Plus, Pencil, Trash2, Loader2, Search, Layers, X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProcurementItem = {
  id: string;
  request_no: string | null;
  yacht_name: string;
  vendor: string;
  description: string;
  category: string;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
  currency: string;
  invoice_ref: string | null;
  status: string;
  requested_date: string;
  ordered_date: string | null;
  received_date: string | null;
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = Omit<ProcurementItem, "id" | "created_at" | "updated_at">;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "electronics", label: "Electronics" },
  { value: "provisions", label: "Provisions" },
  { value: "maintenance", label: "Maintenance" },
  { value: "safety", label: "Safety" },
  { value: "cleaning", label: "Cleaning" },
  { value: "clothing", label: "Clothing" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "requested", label: "Requested" },
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_FORM: FormState = {
  request_no: null,
  yacht_name: "",
  vendor: "",
  description: "",
  category: "other",
  quantity: 1,
  unit_price: null,
  total_amount: null,
  currency: "AED",
  invoice_ref: null,
  status: "requested",
  requested_date: new Date().toISOString().slice(0, 10),
  ordered_date: null,
  received_date: null,
  requested_by: null,
  notes: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAed(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    requested: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    ordered: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    received: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  const label = STATUSES.find(s => s.value === status)?.label ?? status;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? map.cancelled}`}>
      {label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    electronics: "bg-blue-500/15 text-blue-400",
    provisions: "bg-green-500/15 text-green-400",
    maintenance: "bg-orange-500/15 text-orange-400",
    safety: "bg-red-500/15 text-red-400",
    cleaning: "bg-sky-500/15 text-sky-400",
    clothing: "bg-purple-500/15 text-purple-400",
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

export function ProcurementPage() {
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yachtFilter, setYachtFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [groupByYacht, setGroupByYacht] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcurementItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProcurementItem | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("procurement_items")
      .select("*")
      .order("requested_date", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as ProcurementItem[]);
    setLoading(false);
  }

  // Derived filter options
  const yachtOptions = useMemo(() => {
    const names = [...new Set(items.map(i => i.yacht_name))].sort();
    return names;
  }, [items]);

  const vendorOptions = useMemo(() => {
    const vendors = [...new Set(items.map(i => i.vendor))].sort();
    return vendors;
  }, [items]);

  const yearOptions = useMemo(() => {
    const years = [...new Set(items.map(i => i.requested_date?.slice(0, 4)).filter(Boolean))].sort().reverse();
    return years as string[];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter !== "all") list = list.filter(i => i.status === statusFilter);
    if (categoryFilter !== "all") list = list.filter(i => i.category === categoryFilter);
    if (yachtFilter !== "all") list = list.filter(i => i.yacht_name === yachtFilter);
    if (vendorFilter !== "all") list = list.filter(i => i.vendor === vendorFilter);
    if (yearFilter !== "all") list = list.filter(i => i.requested_date?.startsWith(yearFilter));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(i =>
        i.yacht_name.toLowerCase().includes(s) ||
        i.vendor.toLowerCase().includes(s) ||
        i.description.toLowerCase().includes(s) ||
        (i.request_no ?? "").toLowerCase().includes(s) ||
        (i.invoice_ref ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [items, statusFilter, categoryFilter, yachtFilter, vendorFilter, yearFilter, search]);

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, i) => sum + (i.total_amount ?? 0), 0);
    return {
      total: items.length,
      requested: items.filter(i => i.status === "requested").length,
      ordered: items.filter(i => i.status === "ordered").length,
      received: items.filter(i => i.status === "received").length,
      totalValue,
    };
  }, [items]);

  // Group filtered items by yacht name
  const groupedItems = useMemo(() => {
    if (!groupByYacht) return null;
    const map = new Map<string, ProcurementItem[]>();
    for (const item of filtered) {
      const group = map.get(item.yacht_name) ?? [];
      group.push(item);
      map.set(item.yacht_name, group);
    }
    return map;
  }, [filtered, groupByYacht]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(item: ProcurementItem) {
    setEditing(item);
    const { id, created_at, updated_at, ...rest } = item;
    setForm(rest);
    setOpen(true);
  }

  function setF<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // Auto-compute total_amount from qty × unit_price
      if (key === "quantity" || key === "unit_price") {
        const qty = key === "quantity" ? (value as number) : prev.quantity;
        const price = key === "unit_price" ? (value as number | null) : prev.unit_price;
        next.total_amount = qty != null && price != null ? qty * price : null;
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.yacht_name.trim()) { toast.error("Yacht name is required"); return; }
    if (!form.vendor.trim()) { toast.error("Vendor is required"); return; }
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    setBusy(true);
    try {
      const payload = {
        request_no: form.request_no?.trim() || null,
        yacht_name: form.yacht_name.trim(),
        vendor: form.vendor.trim(),
        description: form.description.trim(),
        category: form.category,
        quantity: form.quantity,
        unit_price: form.unit_price,
        total_amount: form.total_amount,
        currency: form.currency || "AED",
        invoice_ref: form.invoice_ref?.trim() || null,
        status: form.status,
        requested_date: form.requested_date,
        ordered_date: form.ordered_date || null,
        received_date: form.received_date || null,
        requested_by: form.requested_by?.trim() || null,
        notes: form.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("procurement_items")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        const { error } = await (supabase as any)
          .from("procurement_items")
          .insert([payload]);
        if (error) throw error;
        toast.success("Request created");
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
      .from("procurement_items")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success("Request deleted"); await load(); }
    setDeleteTarget(null);
  }

  const hasFilters =
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    yachtFilter !== "all" ||
    vendorFilter !== "all" ||
    yearFilter !== "all" ||
    search.trim() !== "";

  function clearFilters() {
    setStatusFilter("all");
    setCategoryFilter("all");
    setYachtFilter("all");
    setVendorFilter("all");
    setYearFilter("all");
    setSearch("");
  }

  // Shared table columns renderer
  function TableRows({ rows }: { rows: ProcurementItem[] }) {
    return (
      <>
        {rows.map(item => (
          <tr key={item.id} className="border-b border-border/50 hover:bg-accent/20 transition group">
            <td className="px-3 py-2 text-xs text-muted-foreground font-mono whitespace-nowrap">
              {item.request_no ?? "—"}
            </td>
            <td className="px-3 py-2 font-medium whitespace-nowrap">{item.yacht_name}</td>
            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{item.vendor}</td>
            <td className="px-3 py-2 max-w-[200px] truncate" title={item.description}>
              {item.description}
            </td>
            <td className="px-3 py-2"><CategoryBadge category={item.category} /></td>
            <td className="px-3 py-2 tabular-nums text-center">{item.quantity}</td>
            <td className="px-3 py-2 tabular-nums text-right">{fmtAed(item.unit_price)}</td>
            <td className="px-3 py-2 tabular-nums text-right font-medium">{fmtAed(item.total_amount)}</td>
            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
              {item.invoice_ref ?? "—"}
            </td>
            <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
              {fmtDate(item.requested_date)}
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition justify-end">
                <button
                  onClick={() => openEdit(item)}
                  className="rounded p-1 hover:bg-muted transition"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="rounded p-1 hover:bg-destructive/10 transition"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  const TABLE_HEADERS = ["Ref", "Yacht", "Vendor", "Description", "Category", "Qty", "Unit Price", "Total (AED)", "Invoice Ref", "Status", "Requested", ""];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/40 px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Procurement</div>
            <h1 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Procurement
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={groupByYacht ? "default" : "outline"}
              className="gap-1.5 h-8 text-xs"
              onClick={() => setGroupByYacht(v => !v)}
            >
              <Layers className="h-3.5 w-3.5" />
              Group by Yacht
            </Button>
            <Button onClick={openNew} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Request
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Requests", value: stats.total, color: "text-primary", isNum: false },
            { label: "Requested", value: stats.requested, color: "text-blue-400", isNum: false },
            { label: "Ordered", value: stats.ordered, color: "text-amber-400", isNum: false },
            { label: "Received", value: stats.received, color: "text-emerald-400", isNum: false },
            { label: "Total Value (AED)", value: fmtAed(stats.totalValue), color: "text-foreground", isNum: true },
          ].map(s => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5"
            >
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className={`font-display ${s.isNum ? "text-base" : "text-xl"} font-bold tabular-nums ${s.color}`}>
                  {s.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 w-44 pl-8 text-xs"
            />
          </div>

          <Select value={yachtFilter} onValueChange={setYachtFilter}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="All Yachts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Yachts</SelectItem>
              {yachtOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendorOptions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-32 text-xs">
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

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
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
            <ShoppingCart className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {hasFilters ? "No items match your filters." : "No procurement requests yet. Create your first request."}
            </p>
          </div>
        ) : groupByYacht && groupedItems ? (
          // Grouped view
          <div className="space-y-4">
            {[...groupedItems.entries()].map(([yacht, rows]) => {
              const subtotal = rows.reduce((s, i) => s + (i.total_amount ?? 0), 0);
              return (
                <div key={yacht} className="overflow-x-auto rounded-lg border border-border bg-card">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
                    <span className="text-sm font-semibold">{yacht}</span>
                    <span className="text-xs text-muted-foreground">
                      {rows.length} item{rows.length !== 1 ? "s" : ""} ·{" "}
                      <span className="font-medium text-foreground">AED {fmtAed(subtotal)}</span>
                    </span>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                        {TABLE_HEADERS.map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <TableRows rows={rows} />
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ) : (
          // Flat view
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  {TABLE_HEADERS.map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableRows rows={filtered} />
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              {editing ? `Edit — ${editing.description.slice(0, 40)}` : "New Procurement Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Request No.</Label>
                <Input
                  value={form.request_no ?? ""}
                  onChange={e => setF("request_no", e.target.value || null)}
                  placeholder="e.g. PO-2026-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Requested Date</Label>
                <Input
                  type="date"
                  value={form.requested_date}
                  onChange={e => setF("requested_date", e.target.value)}
                />
              </div>
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
                <Label>Vendor <span className="text-destructive">*</span></Label>
                <Input
                  value={form.vendor}
                  onChange={e => setF("vendor", e.target.value)}
                  placeholder="e.g. Amazon, Carrefour"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Input
                  value={form.description}
                  onChange={e => setF("description", e.target.value)}
                  placeholder="What was ordered…"
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
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setF("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => setF("quantity", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Price (AED)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price ?? ""}
                  onChange={e => setF("unit_price", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Total Amount (AED)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total_amount ?? ""}
                  onChange={e => setF("total_amount", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Auto-calculated from Qty × Unit Price"
                />
                <p className="text-[10px] text-muted-foreground">
                  Auto-calculated from Qty × Unit Price. Override manually if needed.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Ref</Label>
                <Input
                  value={form.invoice_ref ?? ""}
                  onChange={e => setF("invoice_ref", e.target.value || null)}
                  placeholder="e.g. INV-2026-042"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Requested By</Label>
                <Input
                  value={form.requested_by ?? ""}
                  onChange={e => setF("requested_by", e.target.value || null)}
                  placeholder="Name or team"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ordered Date</Label>
                <Input
                  type="date"
                  value={form.ordered_date ?? ""}
                  onChange={e => setF("ordered_date", e.target.value || null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Received Date</Label>
                <Input
                  type="date"
                  value={form.received_date ?? ""}
                  onChange={e => setF("received_date", e.target.value || null)}
                />
              </div>
            </div>

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
                {editing ? "Save Changes" : "Create Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete request?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.request_no && (
                <><strong>{deleteTarget.request_no}</strong> — </>
              )}
              <strong>{deleteTarget?.description?.slice(0, 60)}</strong> for{" "}
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
