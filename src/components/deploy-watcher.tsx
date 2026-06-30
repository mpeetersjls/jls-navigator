import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * DeployWatcher — shows a top banner when a new build of the app has been
 * deployed (Cloudflare rebuild / repo push) while the user is still running an
 * older bundle.
 *
 * How it works: every build writes public/version.json with a unique buildId,
 * and vite injects that same id into the bundle as __BUILD_ID__. This component
 * polls /version.json; when the served id differs from the running id, a new
 * deploy has landed. It then counts down and auto-refreshes — unless the user
 * hits Stop, in which case a persistent "Refresh now" bar remains.
 */

declare const __BUILD_ID__: string;

const POLL_MS = 60_000;        // re-check every 60s
const COUNTDOWN_SECS = 30;     // auto-refresh countdown once a new build is seen

export function DeployWatcher() {
  const runningId = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
  const [newBuild, setNewBuild] = useState<string | null>(null);
  const [secs, setSecs] = useState(COUNTDOWN_SECS);
  const [stopped, setStopped] = useState(false);
  const seenRef = useRef(false);

  const check = useCallback(async () => {
    // Never nag in local dev (id is "dev" and version.json doesn't change mid-session).
    if (runningId === "dev" || seenRef.current) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      if (data.buildId && data.buildId !== runningId) {
        seenRef.current = true;
        setNewBuild(data.buildId);
      }
    } catch {
      /* offline / transient — try again next tick */
    }
  }, [runningId]);

  // Poll on an interval + whenever the tab regains focus.
  useEffect(() => {
    const id = setInterval(check, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [check]);

  // Countdown → auto-refresh, unless the user pressed Stop.
  useEffect(() => {
    if (!newBuild || stopped) return;
    if (secs <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [newBuild, stopped, secs]);

  if (!newBuild) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "9px 16px",
        background: "linear-gradient(90deg, #0F2030, #0D1520)",
        borderBottom: "1px solid rgba(232,160,32,0.45)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.45)",
        fontFamily: "'Space Grotesk', sans-serif",
        color: "#E8EDF5",
        fontSize: 13.5,
      }}
    >
      <RefreshCw
        size={15}
        style={{ color: "#E8A020", animation: stopped ? "none" : "spin 2s linear infinite" }}
      />
      <span style={{ fontWeight: 600 }}>
        A new version of Polaris has been deployed.
        {!stopped && (
          <span style={{ color: "#00C4CC", marginLeft: 6 }}>
            Refreshing in {secs}s…
          </span>
        )}
      </span>

      <button
        onClick={() => window.location.reload()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#00C4CC",
          color: "#04141A",
          border: "none",
          borderRadius: 7,
          padding: "5px 12px",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <RefreshCw size={13} /> Refresh now
      </button>

      {!stopped && (
        <button
          onClick={() => setStopped(true)}
          title="Stop the automatic refresh"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "transparent",
            color: "#7A9DB8",
            border: "1px solid rgba(122,157,184,0.4)",
            borderRadius: 7,
            padding: "5px 11px",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          <X size={13} /> Stop
        </button>
      )}
    </div>
  );
}
