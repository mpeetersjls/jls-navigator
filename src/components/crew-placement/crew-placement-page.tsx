/**
 * Crew Placement — managed/placed crew suite (roster, certifications, contracts,
 * payroll, documents, templates). Separate from the core Crew module; a placed crew
 * record can link to a vessel and (later) to a crew_members row.
 *
 * Phase 1: full roster + certification/contract/payroll/document tracking + template
 * management. Phase 2 (next): PDF generation of contracts & payslips from templates,
 * e-sign hand-off, and payroll calculation.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, BadgeCheck, FileText, Wallet, FolderOpen, LayoutTemplate, Plus, Search,
  Ship, XCircle, Pencil, Anchor as AnchorIcon, AlertTriangle,
} from "lucide-react";

type Tab = "roster" | "certs" | "contracts" | "payroll" | "documents" | "templates";
const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "roster", label: "Roster", icon: Users },
  { key: "certs", label: "Certifications", icon: BadgeCheck },
  { key: "contracts", label: "Contracts", icon: FileText },
  { key: "payroll", label: "Payroll", icon: Wallet },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
];

const PLACEMENT_TYPES = ["managed", "placed", "pool"];
const STATUSES = ["active", "available", "onboard", "on_leave", "inactive"];
const CURRENCIES = ["USD", "EUR", "GBP", "AED"];
const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400", onboard: "bg-blue-500/15 text-blue-400",
  available: "bg-amber-500/15 text-amber-400", on_leave: "bg-violet-500/15 text-violet-400",
  inactive: "bg-slate-500/15 text-slate-400",
};
const db = () => supabase as any;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const daysUntil = (d: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

// ── Lightweight modal ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[88vh] overflow-auto rounded-xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted/50"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>{children}</div>;
}
const fieldCls = "w-full h-8 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export function CrewPlacementPage() {
  const [tab, setTab] = useState<Tab>("roster");
  const [crew, setCrew] = useState<any[]>([]);
  const [yachts, setYachts] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => { void loadAll(); }, []);
  async function loadAll() {
    const [c, y, ce, co, pa, dc, te] = await Promise.all([
      db().from("placed_crew").select("*, yacht:yachts(vessel_name)").order("full_name"),
      db().from("yachts").select("id, vessel_name, flag").eq("archive", false).order("vessel_name"),
      db().from("crew_placement_certs").select("*, crew:placed_crew(full_name)").order("expiry_date", { ascending: true }),
      db().from("crew_contracts").select("*, crew:placed_crew(full_name), yacht:yachts(vessel_name)").order("created_at", { ascending: false }),
      db().from("crew_payslips").select("*, crew:placed_crew(full_name)").order("period_month", { ascending: false }),
      db().from("crew_placement_documents").select("*, crew:placed_crew(full_name)").order("created_at", { ascending: false }),
      db().from("crew_placement_templates").select("*").order("kind"),
    ]);
    setCrew(c.data ?? []); setYachts(y.data ?? []); setCerts(ce.data ?? []);
    setContracts(co.data ?? []); setPayslips(pa.data ?? []); setDocs(dc.data ?? []); setTemplates(te.data ?? []);
  }

  const kpis = useMemo(() => ({
    managed: crew.filter((c) => c.placement_type === "managed").length,
    onboard: crew.filter((c) => c.status === "onboard").length,
    expiringCerts: certs.filter((c) => { const d = daysUntil(c.expiry_date); return d != null && d <= 60; }).length,
    activeContracts: contracts.filter((c) => c.status === "active" || c.status === "signed").length,
  }), [crew, certs, contracts]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card/40 px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AnchorIcon className="h-3.5 w-3.5" /> Services <span className="opacity-40">/</span> <span className="text-foreground">Crew Placement</span></div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Crew Placement & Payroll</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3">
        {[
          { label: "Managed Crew", value: kpis.managed, icon: Users, accent: "text-primary" },
          { label: "Onboard", value: kpis.onboard, icon: Ship, accent: "text-blue-400" },
          { label: "Certs Expiring (60d)", value: kpis.expiringCerts, icon: AlertTriangle, accent: "text-amber-400" },
          { label: "Active Contracts", value: kpis.activeContracts, icon: FileText, accent: "text-emerald-400" },
        ].map((k) => (
          <div key={k.label} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div><div className={`font-display text-2xl font-bold tabular-nums ${k.accent}`}>{k.value}</div></div>
            <k.icon className={`h-6 w-6 ${k.accent} opacity-60`} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-border px-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === "roster" && <Roster crew={crew} yachts={yachts} reload={loadAll} />}
        {tab === "certs" && <Certs certs={certs} crew={crew} reload={loadAll} />}
        {tab === "contracts" && <Contracts contracts={contracts} crew={crew} yachts={yachts} templates={templates} reload={loadAll} />}
        {tab === "payroll" && <Payroll payslips={payslips} crew={crew} templates={templates} reload={loadAll} />}
        {tab === "documents" && <Documents docs={docs} crew={crew} reload={loadAll} />}
        {tab === "templates" && <Templates templates={templates} reload={loadAll} />}
      </div>
    </div>
  );
}

// ── Roster ────────────────────────────────────────────────────────────────────
function Roster({ crew, yachts, reload }: { crew: any[]; yachts: any[]; reload: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const blank = { full_name: "", email: "", phone: "", nationality: "", rank: "", placement_type: "managed", status: "active", yacht_id: "", rotation: "", salary: "", currency: "USD", start_date: "" };
  const filtered = crew.filter((c) => !q.trim() || [c.full_name, c.rank, c.nationality, c.yacht?.vessel_name].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));

  async function save(form: any) {
    const row = { ...form, salary: form.salary ? Number(form.salary) : null, yacht_id: form.yacht_id || null, updated_at: new Date().toISOString() };
    Object.keys(row).forEach((k) => row[k] === "" && (row[k] = null));
    const { error } = edit?.id ? await db().from("placed_crew").update(row).eq("id", edit.id) : await db().from("placed_crew").insert(row);
    if (error) return toast.error(error.message);
    toast.success(edit?.id ? "Updated" : "Crew added"); setEdit(null); await reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search crew…" className="pl-8 h-8 text-sm" /></div>
        <Button size="sm" className="h-8 gap-1.5 ml-auto" onClick={() => setEdit(blank)}><Plus className="h-3.5 w-3.5" /> Add Crew</Button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr className="bg-muted/40 border-b border-border">{["Name", "Rank", "Nationality", "Type", "Vessel", "Rotation", "Salary", "Status", ""].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/50">
            {filtered.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">No crew yet. Add your first placed/managed crew member.</td></tr> :
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/10">
                  <td className="px-3 py-2 text-xs font-medium">{c.full_name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.rank ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.nationality ?? "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{c.placement_type}</td>
                  <td className="px-3 py-2 text-xs">{c.yacht?.vessel_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.rotation ?? "—"}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{c.salary != null ? `${Number(c.salary).toLocaleString()} ${c.currency ?? ""}` : "—"}</td>
                  <td className="px-3 py-2"><span className={`inline-flex rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase ${STATUS_COLOR[c.status] ?? "bg-muted/60 text-muted-foreground"}`}>{(c.status ?? "").replace(/_/g, " ")}</span></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setEdit({ ...blank, ...c, yacht_id: c.yacht_id ?? "", salary: c.salary ?? "", start_date: c.start_date ?? "" })} className="rounded p-1 text-muted-foreground/60 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {edit && <CrewModal init={edit} yachts={yachts} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}
function CrewModal({ init, yachts, onClose, onSave }: { init: any; yachts: any[]; onClose: () => void; onSave: (f: any) => void }) {
  const [f, setF] = useState(init);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  return (
    <Modal title={init.id ? "Edit Crew" : "Add Crew"} onClose={onClose}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={!f.full_name?.trim()} onClick={() => onSave(f)}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Full name"><input className={fieldCls} value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></Labeled>
        <Labeled label="Rank / position"><input className={fieldCls} value={f.rank} onChange={(e) => set("rank", e.target.value)} /></Labeled>
        <Labeled label="Email"><input className={fieldCls} value={f.email} onChange={(e) => set("email", e.target.value)} /></Labeled>
        <Labeled label="Phone"><input className={fieldCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Labeled>
        <Labeled label="Nationality"><input className={fieldCls} value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Labeled>
        <Labeled label="Start date"><input type="date" className={fieldCls} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Labeled>
        <Labeled label="Type"><select className={fieldCls} value={f.placement_type} onChange={(e) => set("placement_type", e.target.value)}>{PLACEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Labeled>
        <Labeled label="Status"><select className={fieldCls} value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Labeled>
        <Labeled label="Vessel association"><select className={fieldCls} value={f.yacht_id} onChange={(e) => set("yacht_id", e.target.value)}><option value="">— none —</option>{yachts.map((y) => <option key={y.id} value={y.id}>{y.vessel_name}</option>)}</select></Labeled>
        <Labeled label="Rotation"><input className={fieldCls} value={f.rotation} onChange={(e) => set("rotation", e.target.value)} placeholder="e.g. 2:2" /></Labeled>
        <Labeled label="Salary"><input type="number" className={fieldCls} value={f.salary} onChange={(e) => set("salary", e.target.value)} /></Labeled>
        <Labeled label="Currency"><select className={fieldCls} value={f.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Labeled>
      </div>
    </Modal>
  );
}

// ── Certifications ──────────────────────────────────────────────────────────────
function Certs({ certs, crew, reload }: { certs: any[]; crew: any[]; reload: () => Promise<void> }) {
  const [add, setAdd] = useState(false);
  const blank = { placed_crew_id: "", cert_type: "", cert_number: "", issuing_authority: "", issued_date: "", expiry_date: "" };
  async function save(f: any) {
    const row = { ...f }; Object.keys(row).forEach((k) => row[k] === "" && (row[k] = null));
    const { error } = await db().from("crew_placement_certs").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Certificate added"); setAdd(false); await reload();
  }
  function expiryBadge(d: string | null) {
    const days = daysUntil(d);
    if (days == null) return <span className="text-muted-foreground">—</span>;
    const cls = days < 0 ? "bg-red-500/15 text-red-400" : days <= 60 ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400";
    return <span className={`inline-flex rounded-full px-1.5 py-0 text-[10px] font-semibold ${cls}`}>{fmtDate(d)}{days < 0 ? " · expired" : days <= 60 ? ` · ${days}d` : ""}</span>;
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" className="h-8 gap-1.5" onClick={() => setAdd(true)}><Plus className="h-3.5 w-3.5" /> Add Certificate</Button></div>
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="bg-muted/40 border-b border-border">{["Crew", "Certificate", "Number", "Authority", "Issued", "Expiry"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/50">
            {certs.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No certificates tracked yet.</td></tr> :
              certs.map((c) => (
                <tr key={c.id} className="hover:bg-muted/10">
                  <td className="px-3 py-2 text-xs font-medium">{c.crew?.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{c.cert_type}</td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{c.cert_number ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.issuing_authority ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(c.issued_date)}</td>
                  <td className="px-3 py-2 text-xs">{expiryBadge(c.expiry_date)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {add && <SimpleAdd title="Add Certificate" onClose={() => setAdd(false)} onSave={save} init={blank}
        fields={[
          { k: "placed_crew_id", label: "Crew", type: "crew" }, { k: "cert_type", label: "Certificate type" },
          { k: "cert_number", label: "Number" }, { k: "issuing_authority", label: "Issuing authority" },
          { k: "issued_date", label: "Issued", type: "date" }, { k: "expiry_date", label: "Expiry", type: "date" },
        ]} crew={crew} required={["placed_crew_id", "cert_type"]} />}
    </div>
  );
}

// ── Contracts ────────────────────────────────────────────────────────────────
function Contracts({ contracts, crew, yachts, templates, reload }: any) {
  const [add, setAdd] = useState(false);
  const blank = { placed_crew_id: "", yacht_id: "", template_id: "", contract_type: "SEA", start_date: "", end_date: "", salary: "", currency: "USD", rotation: "", status: "draft" };
  async function save(f: any) {
    const row = { ...f, salary: f.salary ? Number(f.salary) : null }; Object.keys(row).forEach((k) => row[k] === "" && (row[k] = null));
    const { error } = await db().from("crew_contracts").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Contract created (PDF generation comes in Phase 2)"); setAdd(false); await reload();
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" className="h-8 gap-1.5" onClick={() => setAdd(true)}><Plus className="h-3.5 w-3.5" /> New Contract</Button></div>
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="bg-muted/40 border-b border-border">{["Crew", "Vessel", "Type", "Start", "End", "Salary", "Status"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/50">
            {contracts.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">No contracts yet.</td></tr> :
              contracts.map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/10">
                  <td className="px-3 py-2 text-xs font-medium">{c.crew?.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{c.yacht?.vessel_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{c.contract_type ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(c.start_date)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(c.end_date)}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{c.salary != null ? `${Number(c.salary).toLocaleString()} ${c.currency ?? ""}` : "—"}</td>
                  <td className="px-3 py-2"><span className="inline-flex rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase bg-muted/60 text-muted-foreground">{c.status}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {add && <SimpleAdd title="New Contract" onClose={() => setAdd(false)} onSave={save} init={blank}
        fields={[
          { k: "placed_crew_id", label: "Crew", type: "crew" }, { k: "yacht_id", label: "Vessel", type: "yacht" },
          { k: "template_id", label: "Template", type: "template", templateKind: "contract" }, { k: "contract_type", label: "Contract type" },
          { k: "start_date", label: "Start", type: "date" }, { k: "end_date", label: "End", type: "date" },
          { k: "salary", label: "Salary", type: "number" }, { k: "currency", label: "Currency", type: "currency" },
          { k: "rotation", label: "Rotation" }, { k: "status", label: "Status" },
        ]} crew={crew} yachts={yachts} templates={templates} required={["placed_crew_id"]} />}
    </div>
  );
}

// ── Payroll ────────────────────────────────────────────────────────────────────
function Payroll({ payslips, crew, templates, reload }: any) {
  const [add, setAdd] = useState(false);
  const blank = { placed_crew_id: "", period_month: "", gross: "", net: "", currency: "USD", status: "draft" };
  async function save(f: any) {
    const row = { ...f, gross: f.gross ? Number(f.gross) : null, net: f.net ? Number(f.net) : null }; Object.keys(row).forEach((k) => row[k] === "" && (row[k] = null));
    const { error } = await db().from("crew_payslips").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Payslip created (PDF generation comes in Phase 2)"); setAdd(false); await reload();
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" className="h-8 gap-1.5" onClick={() => setAdd(true)}><Plus className="h-3.5 w-3.5" /> New Payslip</Button></div>
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead><tr className="bg-muted/40 border-b border-border">{["Crew", "Period", "Gross", "Net", "Currency", "Status"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/50">
            {payslips.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No payslips yet.</td></tr> :
              payslips.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/10">
                  <td className="px-3 py-2 text-xs font-medium">{p.crew?.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.period_month ? new Date(p.period_month).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{p.gross != null ? Number(p.gross).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-xs tabular-nums font-medium">{p.net != null ? Number(p.net).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.currency}</td>
                  <td className="px-3 py-2"><span className="inline-flex rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase bg-muted/60 text-muted-foreground">{p.status}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {add && <SimpleAdd title="New Payslip" onClose={() => setAdd(false)} onSave={save} init={blank}
        fields={[
          { k: "placed_crew_id", label: "Crew", type: "crew" }, { k: "period_month", label: "Pay month", type: "date" },
          { k: "gross", label: "Gross", type: "number" }, { k: "net", label: "Net", type: "number" },
          { k: "currency", label: "Currency", type: "currency" }, { k: "status", label: "Status" },
        ]} crew={crew} templates={templates} required={["placed_crew_id", "period_month"]} />}
    </div>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────
function Documents({ docs, crew, reload }: { docs: any[]; crew: any[]; reload: () => Promise<void> }) {
  const [add, setAdd] = useState(false);
  const blank = { placed_crew_id: "", doc_type: "cv", title: "" };
  async function save(f: any) {
    const row = { ...f }; Object.keys(row).forEach((k) => row[k] === "" && (row[k] = null));
    const { error } = await db().from("crew_placement_documents").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Document recorded"); setAdd(false); await reload();
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" className="h-8 gap-1.5" onClick={() => setAdd(true)}><Plus className="h-3.5 w-3.5" /> Add Document</Button></div>
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="bg-muted/40 border-b border-border">{["Crew", "Type", "Title", "Added"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/50">
            {docs.length === 0 ? <tr><td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">No documents yet. (File upload arrives in Phase 2.)</td></tr> :
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/10">
                  <td className="px-3 py-2 text-xs font-medium">{d.crew?.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{d.doc_type}</td>
                  <td className="px-3 py-2 text-xs">{d.title}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(d.created_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {add && <SimpleAdd title="Add Document" onClose={() => setAdd(false)} onSave={save} init={blank}
        fields={[{ k: "placed_crew_id", label: "Crew", type: "crew" }, { k: "doc_type", label: "Type" }, { k: "title", label: "Title" }]}
        crew={crew} required={["placed_crew_id", "title"]} />}
    </div>
  );
}

// ── Templates ────────────────────────────────────────────────────────────────
function Templates({ templates, reload }: { templates: any[]; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState<any | null>(null);
  const blank = { kind: "contract", name: "", body: "" };
  async function save(f: any) {
    const row = { kind: f.kind, name: f.name, body: f.body, updated_at: new Date().toISOString() };
    const { error } = f.id ? await db().from("crew_placement_templates").update(row).eq("id", f.id) : await db().from("crew_placement_templates").insert(row);
    if (error) return toast.error(error.message);
    toast.success("Template saved"); setEdit(null); await reload();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Contract & payslip templates. Use <code className="rounded bg-muted px-1">{"{{placeholders}}"}</code> like <code className="rounded bg-muted px-1">{"{{crew_name}}"}</code>, <code className="rounded bg-muted px-1">{"{{salary}}"}</code> — they're filled when generating in Phase 2.</p>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setEdit(blank)}><Plus className="h-3.5 w-3.5" /> New Template</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <button key={t.id} onClick={() => setEdit(t)} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition">
            <div className="flex items-center justify-between"><span className="font-medium text-sm">{t.name}</span><span className="inline-flex rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase bg-primary/15 text-primary">{t.kind}</span></div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[11px] text-muted-foreground">{t.body}</p>
          </button>
        ))}
        {templates.length === 0 && <div className="text-sm text-muted-foreground">No templates yet.</div>}
      </div>
      {edit && <TemplateModal init={edit} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}
function TemplateModal({ init, onClose, onSave }: { init: any; onClose: () => void; onSave: (f: any) => void }) {
  const [f, setF] = useState(init);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  return (
    <Modal title={init.id ? "Edit Template" : "New Template"} onClose={onClose}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={!f.name?.trim()} onClick={() => onSave(f)}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Kind"><select className={fieldCls} value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="contract">Contract</option><option value="payslip">Payslip</option></select></Labeled>
        <Labeled label="Name"><input className={fieldCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></Labeled>
      </div>
      <Labeled label="Body"><textarea rows={12} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" value={f.body} onChange={(e) => set("body", e.target.value)} /></Labeled>
    </Modal>
  );
}

// ── Generic add dialog ─────────────────────────────────────────────────────────
function SimpleAdd({ title, init, fields, crew, yachts, templates, required, onClose, onSave }: any) {
  const [f, setF] = useState<any>(init);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const ok = (required ?? []).every((k: string) => String(f[k] ?? "").trim());
  return (
    <Modal title={title} onClose={onClose}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={!ok} onClick={() => onSave(f)}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((fl: any) => (
          <Labeled key={fl.k} label={fl.label}>
            {fl.type === "crew" ? (
              <select className={fieldCls} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)}><option value="">— select —</option>{crew.map((c: any) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
            ) : fl.type === "yacht" ? (
              <select className={fieldCls} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)}><option value="">— none —</option>{(yachts ?? []).map((y: any) => <option key={y.id} value={y.id}>{y.vessel_name}</option>)}</select>
            ) : fl.type === "template" ? (
              <select className={fieldCls} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)}><option value="">— none —</option>{(templates ?? []).filter((t: any) => !fl.templateKind || t.kind === fl.templateKind).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            ) : fl.type === "currency" ? (
              <select className={fieldCls} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            ) : (
              <input type={fl.type === "number" ? "number" : fl.type === "date" ? "date" : "text"} className={fieldCls} value={f[fl.k]} onChange={(e) => set(fl.k, e.target.value)} />
            )}
          </Labeled>
        ))}
      </div>
    </Modal>
  );
}

export default CrewPlacementPage;
