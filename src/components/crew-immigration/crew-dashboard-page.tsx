import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import {
  Users, FileText, AlertTriangle, Clock, Plane, IdCard, Loader2, ChevronRight, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Crew = { id: string; first_name: string; last_name: string; full_name: string | null; status: string | null; passport_expiry_date: string | null };
type Visa = { id: string; status: string | null; given_name: string | null; surname: string | null; country_code: string | null; visa_issuance_date: string | null; approved_at: string | null; visa_expiry: string | null; crew_member_id: string | null };

const DAY = 86400000;
const daysUntil = (d: string | null) => d ? Math.ceil((new Date(d.length === 10 ? d + "T00:00" : d).getTime() - Date.now()) / DAY) : null;
// 30-day activation window from issuance/approval.
const daysToActivate = (v: Visa) => {
  const base = v.visa_issuance_date ?? v.approved_at;
  if (!base) return null;
  return Math.ceil((new Date(base.length === 10 ? base + "T00:00" : base).getTime() + 30 * DAY - Date.now()) / DAY);
};
const crewName = (v: Visa) => `${v.given_name ?? ""} ${v.surname ?? ""}`.trim() || "—";

export function CrewDashboardPage() {
  const navigate = useNavigate();
  const [crew, setCrew] = useState<Crew[]>([]);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [c, v] = await Promise.all([
      fetchAllRows(() => (supabase as any).from("crew_members").select("id, first_name, last_name, full_name, status, passport_expiry_date")),
      fetchAllRows(() => (supabase as any).from("visa_applications").select("id, status, given_name, surname, country_code, visa_issuance_date, approved_at, visa_expiry, crew_member_id")),
    ]);
    setCrew((c.data ?? []) as Crew[]);
    setVisas((v.data ?? []) as Visa[]);
    setLoading(false);
  }

  const m = useMemo(() => {
    const active = crew.filter(x => (x.status ?? "").toLowerCase() === "active").length;
    const approved = visas.filter(v => v.status === "approved");
    const expiredActivation = approved.filter(v => { const d = daysToActivate(v); return d != null && d < 0; });
    const expiringActivation = approved.filter(v => { const d = daysToActivate(v); return d != null && d >= 0 && d <= 30; });
    const passportExpired = crew.filter(x => { const d = daysUntil(x.passport_expiry_date); return d != null && d < 0; });
    const passportSoon = crew.filter(x => { const d = daysUntil(x.passport_expiry_date); return d != null && d >= 0 && d <= 180; });
    const byStatus = (s: string) => visas.filter(v => v.status === s).length;
    return {
      active, approved: approved.length, expiredActivation, expiringActivation, passportExpired, passportSoon,
      pipeline: { draft: byStatus("draft"), submitted: byStatus("submitted"), approved: approved.length, cancelled: byStatus("cancelled"), rejected: byStatus("rejected") },
    };
  }, [crew, visas]);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/70 bg-card/30 px-6 py-3.5">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">Polaris / Crew &amp; Immigration</div>
          <h1 className="mt-0.5 font-display text-[1.25rem] font-semibold tracking-tight">Crew Dashboard</h1>
        </div>
        <button onClick={() => navigate({ to: "/crew-immigration/visas/new" })}
          className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm">+ New Visa Application</button>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Crew on file" value={crew.length} sub={`${m.active} active`} onClick={() => navigate({ to: "/crew-immigration/crew" })} />
            <StatCard icon={Plane} label="Approved visas" value={m.approved} sub="in pipeline" tone={m.approved ? "ok" : undefined} onClick={() => navigate({ to: "/crew-immigration/visas" })} />
            <StatCard icon={Clock} label="Visa action needed" value={m.expiredActivation.length + m.expiringActivation.length} sub={`${m.expiredActivation.length} expired · ${m.expiringActivation.length} expiring`} tone={m.expiredActivation.length ? "bad" : m.expiringActivation.length ? "warn" : "ok"} onClick={() => navigate({ to: "/crew-immigration/visas" })} />
            <StatCard icon={IdCard} label="Passports expiring" value={m.passportExpired.length + m.passportSoon.length} sub={`${m.passportExpired.length} expired · ${m.passportSoon.length} < 6 mo`} tone={m.passportExpired.length ? "bad" : m.passportSoon.length ? "warn" : "ok"} />
          </div>

          {/* Action required */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)]">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-400" /> Action Required</h2>
            {m.expiredActivation.length === 0 && m.expiringActivation.length === 0 && m.passportExpired.length === 0 && m.passportSoon.length === 0 ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Nothing needs attention — all visas and passports are in good standing.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {m.expiredActivation.map(v => (
                  <ActionRow key={v.id} tone="bad"
                    title={`${crewName(v)} — ${v.country_code ?? ""} visa activation expired`}
                    detail={`Expired ${-(daysToActivate(v) ?? 0)} day(s) ago — a new application is required`}
                    cta="Start new application" onClick={() => navigate({ to: "/crew-immigration/visas/new" })}
                    viewTo={`/crew-immigration/visas/${v.id}`} />
                ))}
                {m.expiringActivation.map(v => (
                  <ActionRow key={v.id} tone="warn"
                    title={`${crewName(v)} — ${v.country_code ?? ""} visa must be activated`}
                    detail={`${daysToActivate(v)} day(s) left in the activation window`}
                    cta="View" viewTo={`/crew-immigration/visas/${v.id}`} />
                ))}
                {m.passportExpired.map(c => (
                  <ActionRow key={c.id} tone="bad"
                    title={`${c.full_name || `${c.first_name} ${c.last_name}`} — passport expired`}
                    detail={`Passport expired ${-(daysUntil(c.passport_expiry_date) ?? 0)} day(s) ago`}
                    cta="Open profile" viewTo={`/crew-immigration/crew/${c.id}`} />
                ))}
                {m.passportSoon.slice(0, 20).map(c => (
                  <ActionRow key={c.id} tone="warn"
                    title={`${c.full_name || `${c.first_name} ${c.last_name}`} — passport expiring`}
                    detail={`Expires in ${daysUntil(c.passport_expiry_date)} day(s)`}
                    cta="Open profile" viewTo={`/crew-immigration/crew/${c.id}`} />
                ))}
              </div>
            )}
          </section>

          {/* Visa pipeline */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)]">
            <h2 className="mb-3 font-display text-sm font-semibold">Visa Pipeline</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([["Draft", m.pipeline.draft], ["Submitted", m.pipeline.submitted], ["Approved", m.pipeline.approved], ["Cancelled", m.pipeline.cancelled], ["Rejected", m.pipeline.rejected]] as const).map(([label, n]) => (
                <Link key={label} to={"/crew-immigration/visas" as any} className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-center transition hover:border-primary/40 hover:bg-accent/30">
                  <div className="font-display text-xl font-bold">{n}</div>
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone, onClick }: { icon: any; label: string; value: number; sub?: string; tone?: "ok" | "warn" | "bad"; onClick?: () => void }) {
  const ring = tone === "bad" ? "text-red-400" : tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "text-primary";
  return (
    <button onClick={onClick} className={cn("rounded-xl border border-border bg-card p-4 text-left shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)] transition", onClick && "hover:border-primary/50 cursor-pointer")}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{label}</span>
        <Icon className={cn("h-4 w-4", ring)} />
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </button>
  );
}

function ActionRow({ tone, title, detail, cta, onClick, viewTo }: { tone: "warn" | "bad"; title: string; detail: string; cta: string; onClick?: () => void; viewTo?: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", tone === "bad" ? "bg-red-400" : "bg-amber-400")} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{detail}</div>
      </div>
      {onClick && <button onClick={onClick} className="shrink-0 rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25">{cta}</button>}
      {!onClick && viewTo && <Link to={viewTo as any} className="flex shrink-0 items-center gap-0.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">{cta}<ChevronRight className="h-3 w-3" /></Link>}
      {onClick && viewTo && <Link to={viewTo as any} className="shrink-0 text-muted-foreground/60 hover:text-foreground"><ChevronRight className="h-4 w-4" /></Link>}
    </div>
  );
}
