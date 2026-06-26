/**
 * Polaris Redesign — card components (#195).
 * StatCard · PolarisCard · CrewRow · TrafficLight · ComplianceBar.
 */
import type { CSSProperties, ReactNode } from "react";
import { TIcon } from "./primitives";

export type StatVariant = "active" | "expiring" | "expired" | "neutral";

const STAT_COLOUR: Record<StatVariant, string> = {
  active: "var(--pds-active)",
  expiring: "var(--pds-expiring)",
  expired: "var(--pds-expired)",
  neutral: "var(--pds-gold-light)",
};

// ── Metric stat card (2px top accent = the metric's traffic light) ───────────
export function StatCard({
  label,
  value,
  variant,
  sub,
  onClick,
}: {
  label: string;
  value: number | string;
  variant: StatVariant;
  sub?: string;
  onClick?: () => void;
}) {
  const colour = STAT_COLOUR[variant];
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--pds-surface-2)",
        border: "1px solid var(--pds-border)",
        borderRadius: "var(--pds-radius-lg)",
        padding: 16,
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        minHeight: 88,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: colour,
        }}
      />
      <div
        style={{
          fontSize: "var(--pds-fs-label)",
          color: "var(--pds-text-secondary)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--pds-font-display)",
          fontSize: "var(--pds-fs-hero)",
          fontWeight: 600,
          color: colour,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "var(--pds-fs-label)",
            color: colour,
            marginTop: 5,
            opacity: 0.75,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Primary content card ──────────────────────────────────────────────────────
export function PolarisCard({
  title,
  icon,
  badge,
  action,
  children,
  noBodyPad,
}: {
  title: string;
  icon?: string;
  badge?: ReactNode;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  noBodyPad?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--pds-surface-2)",
        border: "1px solid var(--pds-border)",
        borderRadius: "var(--pds-radius-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--pds-border-soft)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "var(--pds-font-display)",
            fontSize: "var(--pds-fs-card-title)",
            fontWeight: 600,
            color: "var(--pds-gold-light)",
          }}
        >
          {icon && <TIcon name={icon} size={16} />}
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {badge}
          {action && (
            <button
              onClick={action.onClick}
              style={{
                background: "none",
                border: "none",
                fontSize: "var(--pds-fs-label)",
                color: "var(--pds-text-secondary)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              {action.label} →
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: noBodyPad ? 0 : "14px 16px" }}>{children}</div>
    </div>
  );
}

// ── Crew list row ─────────────────────────────────────────────────────────────
export function CrewRow({
  name,
  detail,
  badge,
}: {
  name: string;
  detail: string;
  badge?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--pds-border-soft)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--pds-fs-body)",
            color: "var(--pds-text)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: "var(--pds-fs-label)",
            color: "var(--pds-text-secondary)",
            marginTop: 2,
          }}
        >
          {detail}
        </div>
      </div>
      {badge}
    </div>
  );
}

// ── Fleet traffic light row ───────────────────────────────────────────────────
export function TrafficLight({
  expired,
  expiring,
  active,
  label,
  count,
  countVariant,
  onClick,
}: {
  expired: boolean;
  expiring: boolean;
  active: boolean;
  label: string;
  count: string;
  countVariant: StatVariant;
  onClick?: () => void;
}) {
  const dot = (bg: string, on: boolean): CSSProperties => ({
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: bg,
    opacity: on ? 1 : 0.2,
  });
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", gap: 5 }}>
        <div style={dot("var(--pds-expired)", expired)} />
        <div style={dot("var(--pds-expiring)", expiring)} />
        <div style={dot("var(--pds-active)", active)} />
      </div>
      <span
        style={{
          fontSize: "var(--pds-fs-body)",
          color: "var(--pds-text)",
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "var(--pds-fs-body)",
          fontWeight: 600,
          color: STAT_COLOUR[countVariant],
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── Compliance progress bar (traffic-light fill by %) ────────────────────────
export function ComplianceBar({ pct }: { pct: number }) {
  const colour =
    pct >= 70
      ? "var(--pds-active)"
      : pct >= 40
        ? "var(--pds-expiring)"
        : "var(--pds-expired)";
  return (
    <div
      style={{
        height: 4,
        background: "var(--pds-surface-3)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: colour,
        }}
      />
    </div>
  );
}
