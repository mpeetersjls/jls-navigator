/**
 * Polaris Redesign — feedback components (#195).
 * ToastProvider + useToast (navy/gold, bottom-right/centre, 3s auto-dismiss) and
 * ConfirmModal (gold top border; never browser confirm/alert).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { PolarisButton, TIcon } from "./primitives";

// ── Toasts ────────────────────────────────────────────────────────────────────
type ToastKind = "success" | "warning" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ICON: Record<ToastKind, string> = {
  success: "circle-check",
  warning: "alert-circle",
  error: "x",
};
const ACCENT: Record<ToastKind, string> = {
  success: "var(--pds-active)",
  warning: "var(--pds-expiring)",
  error: "var(--pds-expired)",
};

const ToastCtx = createContext<(message: string, kind?: ToastKind) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastCtx);
}

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++_id;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          left: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 1000,
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              animation: "pds-toast-in 0.2s ease-out",
              background: "var(--pds-navy)",
              border: `1px solid var(--pds-border-gold)`,
              borderLeft: `3px solid ${ACCENT[t.kind]}`,
              borderRadius: "var(--pds-radius-md)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--pds-gold-light)",
              fontSize: "var(--pds-fs-body)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              minWidth: 240,
            }}
          >
            <TIcon name={ICON[t.kind]} size={18} color={ACCENT[t.kind]} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  confirmIcon,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmIcon?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--pds-navy)",
          border: "1px solid var(--pds-border-gold)",
          borderTop: "3px solid var(--pds-gold)",
          borderRadius: "var(--pds-radius-xl)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--pds-border-soft)",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "var(--pds-fs-title)",
              fontWeight: 600,
              color: "var(--pds-text)",
            }}
          >
            {title}
          </h3>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <TIcon name="x" size={20} color="var(--pds-text-secondary)" />
          </button>
        </div>
        <div
          style={{
            padding: "18px 20px",
            fontSize: "var(--pds-fs-body)",
            color: "var(--pds-text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "0 20px 20px",
          }}
        >
          <PolarisButton variant="ghost" label="Cancel" onClick={onCancel} />
          <PolarisButton
            variant="primary"
            icon={confirmIcon}
            label={busy ? "Working…" : confirmLabel}
            onClick={onConfirm}
            disabled={busy}
          />
        </div>
      </div>
    </div>
  );
}
