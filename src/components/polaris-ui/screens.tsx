/**
 * Polaris Redesign — Dashboard + Visa Reports screens (#195, Phases 2–3).
 * Card-first, action-first, traffic-light layouts built from the polaris-ui library.
 * Generate/Send use the existing /api/visa/* routes; reads use the shared data hook.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateDMY } from "@/lib/visa-reporting/statusHelpers";
import {
  StatCard,
  PolarisCard,
  CrewRow,
  TrafficLight,
  type StatVariant,
} from "./cards";
import {
  StatusBadge,
  PolarisButton,
  SectionLabel,
  Skeleton,
  EmptyState,
  TIcon,
  type BadgeVariant,
} from "./primitives";
import { ConfirmModal, useToast } from "./feedback";
import { useVesselVisaData, type YachtOption, type CrewVisaRow } from "./data";

const STATUS_BADGE: Record<
  CrewVisaRow["status"],
  { variant: BadgeVariant; label: string }
> = {
  active: { variant: "active", label: "Active" },
  expiring_soon: { variant: "expiring", label: "Expiring" },
  expired: { variant: "expired", label: "Expired" },
  no_visa: { variant: "grey", label: "No visa" },
};

interface ReportLogRow {
  id: string;
  generated_at: string;
  sent_at: string | null;
  status: string;
  crew_count: number | null;
  expired_count: number | null;
  expiring_count: number | null;
}

function useReportLog(yachtId: string | null) {
  const [rows, setRows] = useState<ReportLogRow[]>([]);
  const load = useCallback(async () => {
    if (!yachtId) return;
    const { data } = await (supabase as any)
      .from("visa_report_log")
      .select(
        "id, generated_at, sent_at, status, crew_count, expired_count, expiring_count",
      )
      .eq("yacht_id", yachtId)
      .order("generated_at", { ascending: false })
      .limit(20);
    setRows((data ?? []) as ReportLogRow[]);
  }, [yachtId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, reload: load };
}

function useReportActions(yachtId: string | null, onChange: () => void) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const generate = useCallback(async () => {
    if (!yachtId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/visa/report-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ yacht_id: yachtId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generate failed");
      toast("Report generated", "success");
      onChange();
      return data.report?.id as string | undefined;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generate failed", "error");
    } finally {
      setGenerating(false);
    }
  }, [yachtId, token, toast, onChange]);

  const send = useCallback(
    async (reportId: string) => {
      setSending(true);
      try {
        const res = await fetch("/api/visa/report-send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ report_id: reportId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Send failed");
        toast("Report sent", "success");
        onChange();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Send failed", "error");
      } finally {
        setSending(false);
      }
    },
    [token, toast, onChange],
  );

  return { generate, send, generating, sending };
}

function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions: React.ReactNode;
}) {
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--pds-fs-title)",
            fontWeight: 600,
            color: "var(--pds-text)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
        <div
          style={{
            fontSize: "var(--pds-fs-label)",
            color: "var(--pds-text-secondary)",
            marginTop: 2,
          }}
        >
          {today}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function PolarisDashboard({
  yacht,
  onSwitchVessel,
  onOpenReports,
}: {
  yacht: YachtOption | null;
  onSwitchVessel: () => void;
  onOpenReports: () => void;
}) {
  const { loading, rows, counts } = useVesselVisaData(yacht?.id ?? null);
  const { rows: reports, reload: reloadReports } = useReportLog(
    yacht?.id ?? null,
  );
  const { generate, send, generating, sending } = useReportActions(
    yacht?.id ?? null,
    reloadReports,
  );
  const [confirm, setConfirm] = useState(false);

  const canSend = !!yacht?.send_visa_reports && !!yacht?.visa_report_email;
  const alerts = rows.filter(
    (r) => r.status === "expired" || r.status === "expiring_soon",
  );
  const upcoming = rows
    .filter((r) => r.status === "expiring_soon")
    .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));

  async function handleSendLatest() {
    setConfirm(false);
    const latest = reports[0]?.id ?? (await generate());
    if (latest) await send(latest);
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <PolarisButton
              variant="primary"
              icon="refresh"
              label={generating ? "Generating…" : "Generate report"}
              onClick={() => void generate()}
              disabled={generating || !yacht}
            />
            <PolarisButton
              variant="ghost"
              icon="send"
              label="Send report"
              onClick={() => setConfirm(true)}
              disabled={!canSend || sending}
              title={
                canSend
                  ? undefined
                  : "Enable report emails for this vessel first"
              }
            />
          </>
        }
      />

      {/* Stat cards */}
      <SectionLabel>Fleet status — {yacht?.vessel_name ?? "—"}</SectionLabel>
      <div className="pds-stats-grid" style={{ marginBottom: 16 }}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Skeleton key={i} height={88} radius={12} />
          ))
        ) : (
          <>
            <StatCard
              label="Crew onboard"
              value={counts.total}
              variant="neutral"
            />
            <StatCard
              label="Active visas"
              value={counts.active}
              variant="active"
            />
            <StatCard
              label="Expiring"
              value={counts.expiring}
              variant="expiring"
              sub="within 30 days"
            />
            <StatCard
              label="Expired"
              value={counts.expired}
              variant="expired"
            />
            <StatCard label="No visa" value={counts.noVisa} variant="neutral" />
            <StatCard label="Sign-ons (7d)" value={0} variant="neutral" />
          </>
        )}
      </div>

      {/* Two-column: alerts | fleet */}
      <div className="pds-grid-2" style={{ marginBottom: 16 }}>
        <PolarisCard
          title="Compliance alerts"
          icon="alert-triangle"
          badge={
            alerts.length ? (
              <StatusBadge
                variant={counts.expired ? "expired" : "expiring"}
                label={`${alerts.length}`}
              />
            ) : undefined
          }
        >
          {loading ? (
            <Skeleton height={60} />
          ) : alerts.length === 0 ? (
            <EmptyState
              icon="circle-check"
              message="No compliance alerts for this vessel."
            />
          ) : (
            alerts.slice(0, 6).map((c) => {
              const b = STATUS_BADGE[c.status];
              const detail =
                c.status === "expired"
                  ? `${c.daysOverdue}d overdue`
                  : `${c.daysRemaining}d left`;
              return (
                <CrewRow
                  key={c.crewId}
                  name={c.name}
                  detail={`${c.visaType ?? "Visa"} · ${detail}`}
                  badge={<StatusBadge variant={b.variant} label={b.label} />}
                />
              );
            })
          )}
        </PolarisCard>

        <PolarisCard title="Fleet status" icon="traffic-lights">
          {loading ? (
            <Skeleton height={60} />
          ) : (
            <TrafficLight
              expired={counts.expired > 0}
              expiring={counts.expiring > 0}
              active={counts.active > 0}
              label={yacht?.vessel_name ?? "Vessel"}
              count={`${counts.active}/${counts.total}`}
              countVariant={
                counts.expired
                  ? "expired"
                  : counts.expiring
                    ? "expiring"
                    : "active"
              }
              onClick={onOpenReports}
            />
          )}
        </PolarisCard>
      </div>

      {/* Crew onboard */}
      <div style={{ marginBottom: 16 }}>
        <PolarisCard
          title="Crew onboard"
          icon="users"
          action={{ label: "View all", onClick: onOpenReports }}
        >
          {loading ? (
            <Skeleton height={80} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon="users"
              message="No crew on this vessel yet."
              action={{ label: "Switch vessel", onClick: onSwitchVessel }}
            />
          ) : (
            rows.slice(0, 6).map((c) => {
              const b = STATUS_BADGE[c.status];
              return (
                <CrewRow
                  key={c.crewId}
                  name={c.name}
                  detail={`${c.rank ?? "Crew"} · ${c.nationality ?? "—"}`}
                  badge={<StatusBadge variant={b.variant} label={b.label} />}
                />
              );
            })
          )}
        </PolarisCard>
      </div>

      {/* Two-column: recent reports | upcoming expiries */}
      <div className="pds-grid-2">
        <PolarisCard
          title="Recent reports"
          icon="history"
          action={{ label: "Reports", onClick: onOpenReports }}
        >
          {reports.length === 0 ? (
            <EmptyState
              icon="file-description"
              message="No reports generated yet."
              action={{
                label: "Generate report",
                onClick: () => void generate(),
              }}
            />
          ) : (
            reports
              .slice(0, 5)
              .map((r) => (
                <CrewRow
                  key={r.id}
                  name={formatDateDMY(r.generated_at)}
                  detail={`${r.crew_count ?? 0} crew · ${r.expired_count ?? 0} expired`}
                  badge={
                    <StatusBadge
                      variant={
                        r.status === "sent"
                          ? "active"
                          : r.status === "failed"
                            ? "expired"
                            : "neutral"
                      }
                      label={r.status}
                    />
                  }
                />
              ))
          )}
        </PolarisCard>

        <PolarisCard title="Upcoming expiries" icon="clock">
          {loading ? (
            <Skeleton height={60} />
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon="circle-check"
              message="Nothing expiring in the next 30 days."
            />
          ) : (
            upcoming
              .slice(0, 6)
              .map((c) => (
                <CrewRow
                  key={c.crewId}
                  name={c.name}
                  detail={`Expires ${formatDateDMY(c.expiry)}`}
                  badge={
                    <StatusBadge
                      variant="expiring"
                      label={`${c.daysRemaining}d`}
                    />
                  }
                />
              ))
          )}
        </PolarisCard>
      </div>

      {confirm && (
        <ConfirmModal
          title="Send visa report"
          confirmLabel="Confirm & send"
          confirmIcon="send"
          busy={sending || generating}
          onCancel={() => setConfirm(false)}
          onConfirm={handleSendLatest}
        >
          Send the latest visa report for{" "}
          <strong style={{ color: "var(--pds-text)" }}>
            {yacht?.vessel_name}
          </strong>{" "}
          to{" "}
          <strong style={{ color: "var(--pds-text)" }}>
            {yacht?.visa_report_email}
          </strong>{" "}
          by email. A fresh report is generated first if none exists.
        </ConfirmModal>
      )}
    </>
  );
}

// ── Visa Reports screen ───────────────────────────────────────────────────────
export function PolarisVisaReports({
  yachts,
  selectedId,
  onSelect,
}: {
  yachts: YachtOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const yacht = yachts.find((y) => y.id === selectedId) ?? null;
  const { loading, rows, counts } = useVesselVisaData(selectedId);
  const { rows: reports, reload } = useReportLog(selectedId);
  const { generate, send, generating, sending } = useReportActions(
    selectedId,
    reload,
  );
  const [showActive, setShowActive] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const canSend = !!yacht?.send_visa_reports && !!yacht?.visa_report_email;
  const expired = rows.filter((r) => r.status === "expired");
  const expiring = rows.filter((r) => r.status === "expiring_soon");
  const active = rows.filter((r) => r.status === "active");

  async function handleSend() {
    setConfirm(false);
    const latest = reports[0]?.id ?? (await generate());
    if (latest) await send(latest);
  }

  const crewList = (list: CrewVisaRow[], detail: (c: CrewVisaRow) => string) =>
    list.map((c) => {
      const b = STATUS_BADGE[c.status];
      return (
        <CrewRow
          key={c.crewId}
          name={c.name}
          detail={detail(c)}
          badge={<StatusBadge variant={b.variant} label={b.label} />}
        />
      );
    });

  return (
    <>
      <PageHeader
        title="Visa Reports"
        actions={
          <>
            <PolarisButton
              variant="primary"
              icon="refresh"
              label={generating ? "Generating…" : "Generate report"}
              onClick={() => void generate()}
              disabled={generating || !selectedId}
            />
            <PolarisButton
              variant="ghost"
              icon="send"
              label="Send to vessel"
              onClick={() => setConfirm(true)}
              disabled={!canSend || sending}
              title={
                canSend
                  ? undefined
                  : "Enable report emails for this vessel first"
              }
            />
          </>
        }
      />

      {/* Vessel switcher pills */}
      <SectionLabel>Vessel</SectionLabel>
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        {yachts.slice(0, 12).map((y) => {
          const on = y.id === selectedId;
          return (
            <button
              key={y.id}
              onClick={() => onSelect(y.id)}
              style={{
                background: on
                  ? "var(--pds-gold-muted)"
                  : "var(--pds-surface-2)",
                border: `1px solid ${on ? "var(--pds-border-gold-strong)" : "var(--pds-border)"}`,
                color: on
                  ? "var(--pds-gold-light)"
                  : "var(--pds-text-secondary)",
                fontSize: "var(--pds-fs-label)",
                fontWeight: on ? 600 : 500,
                padding: "8px 14px",
                minHeight: 40,
                borderRadius: "var(--pds-radius-full)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <TIcon name="ship" size={14} />
              {y.vessel_name ?? "Unnamed"}
            </button>
          );
        })}
      </div>

      {/* Stat cards */}
      <div className="pds-stats-grid" style={{ marginBottom: 16 }}>
        {loading ? (
          [...Array(4)].map((_, i) => (
            <Skeleton key={i} height={88} radius={12} />
          ))
        ) : (
          <>
            <StatCard
              label="Total crew"
              value={counts.total}
              variant="neutral"
            />
            <StatCard label="Active" value={counts.active} variant="active" />
            <StatCard
              label="Expiring"
              value={counts.expiring}
              variant="expiring"
            />
            <StatCard
              label="Expired"
              value={counts.expired}
              variant="expired"
            />
          </>
        )}
      </div>

      {/* Expired | Expiring */}
      <div className="pds-grid-2" style={{ marginBottom: 16 }}>
        <PolarisCard
          title="Expired — immediate attention"
          icon="alert-circle"
          badge={
            expired.length ? (
              <StatusBadge variant="expired" label={`${expired.length}`} />
            ) : undefined
          }
        >
          {loading ? (
            <Skeleton height={60} />
          ) : expired.length === 0 ? (
            <EmptyState icon="circle-check" message="No expired visas." />
          ) : (
            crewList(
              expired,
              (c) => `${c.visaType ?? "Visa"} · ${c.daysOverdue}d overdue`,
            )
          )}
        </PolarisCard>
        <PolarisCard
          title="Expiring within 30 days"
          icon="clock"
          badge={
            expiring.length ? (
              <StatusBadge variant="expiring" label={`${expiring.length}`} />
            ) : undefined
          }
        >
          {loading ? (
            <Skeleton height={60} />
          ) : expiring.length === 0 ? (
            <EmptyState icon="circle-check" message="Nothing expiring soon." />
          ) : (
            crewList(
              expiring,
              (c) =>
                `${c.visaType ?? "Visa"} · expires ${formatDateDMY(c.expiry)}`,
            )
          )}
        </PolarisCard>
      </div>

      {/* Active (collapsed) */}
      <div style={{ marginBottom: 16 }}>
        <PolarisCard
          title={`Active visas (${active.length})`}
          icon="circle-check"
          action={
            active.length
              ? {
                  label: showActive ? "Hide" : "Show all",
                  onClick: () => setShowActive((s) => !s),
                }
              : undefined
          }
        >
          {loading ? (
            <Skeleton height={40} />
          ) : active.length === 0 ? (
            <EmptyState icon="circle-check" message="No active visas." />
          ) : showActive ? (
            crewList(
              active,
              (c) => `${c.visaType ?? "Visa"} · ${c.daysRemaining}d left`,
            )
          ) : (
            <div
              style={{
                fontSize: "var(--pds-fs-label)",
                color: "var(--pds-text-secondary)",
              }}
            >
              {active.length} crew with active visas. Use “Show all” to expand.
            </div>
          )}
        </PolarisCard>
      </div>

      {/* Report history */}
      <PolarisCard title="Report history" icon="history">
        {reports.length === 0 ? (
          <EmptyState
            icon="file-description"
            message="No reports generated for this vessel yet."
            action={{
              label: "Generate report",
              onClick: () => void generate(),
            }}
          />
        ) : (
          reports.map((r, i) => (
            <CrewRow
              key={r.id}
              name={`${formatDateDMY(r.generated_at)}${i === 0 ? "  · Latest" : ""}`}
              detail={`${r.crew_count ?? 0} crew · ${r.expiring_count ?? 0} expiring · ${r.expired_count ?? 0} expired`}
              badge={
                <StatusBadge
                  variant={
                    r.status === "sent"
                      ? "active"
                      : r.status === "failed"
                        ? "expired"
                        : "neutral"
                  }
                  label={r.status}
                />
              }
            />
          ))
        )}
      </PolarisCard>

      {confirm && (
        <ConfirmModal
          title="Send visa report"
          confirmLabel="Confirm & send"
          confirmIcon="send"
          busy={sending || generating}
          onCancel={() => setConfirm(false)}
          onConfirm={handleSend}
        >
          Send the latest report for{" "}
          <strong style={{ color: "var(--pds-text)" }}>
            {yacht?.vessel_name}
          </strong>{" "}
          to{" "}
          <strong style={{ color: "var(--pds-text)" }}>
            {yacht?.visa_report_email}
          </strong>{" "}
          by email.
        </ConfirmModal>
      )}
    </>
  );
}
