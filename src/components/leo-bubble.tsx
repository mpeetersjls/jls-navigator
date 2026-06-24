import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { COLORS } from "@/lib/tokens";
import { LeoIcon } from "@/components/leo/LeoIcon";

/**
 * Leo floating action bubble — bottom-right of every app screen.
 *
 * Tap it to open the assistant. You can also drag it around and *throw* it —
 * it flies off with momentum and bounces off the edges of the screen. Throw him
 * around repeatedly and he gets a bit cheeky about it.
 */

const SIZE = 56;
const PAD = 8;          // keep this far from the screen edge
const REST = 0.78;      // bounciness (energy kept on each wall bounce)
const FRICTION = 0.985; // per-frame slowdown
const THROW_SPEED = 6;  // px/frame release speed that counts as a "throw"
const MOVE_SLOP = 4;    // px of movement before a press becomes a drag

// Escalating cheeky reactions to repeated throwing.
const LINES = [
  "Wheee! 🌟",
  "Okay — having fun there?",
  "Mate, I'm trying to work here.",
  "Seriously? Again?",
  "I'm an AI, not a stress ball.",
  "Right, that's quite enough.",
  "I'm telling the Captain. 😤",
];

export function LeoBubble() {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  const posRef = useRef<{ x: number; y: number } | null>(null);
  const velRef = useRef({ vx: 0, vy: 0 });
  const lastRef = useRef({ x: 0, y: 0, t: 0 });
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const throwRef = useRef({ count: 0, t: 0 });
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function bounds() {
    return { minX: PAD, minY: PAD, maxX: window.innerWidth - SIZE - PAD, maxY: window.innerHeight - SIZE - PAD };
  }
  function clampPos() {
    if (!posRef.current) return;
    const b = bounds();
    posRef.current.x = Math.max(b.minX, Math.min(b.maxX, posRef.current.x));
    posRef.current.y = Math.max(b.minY, Math.min(b.maxY, posRef.current.y));
  }
  function applyPos() {
    const el = wrapRef.current;
    if (!el || !posRef.current) return;
    el.style.left = `${posRef.current.x}px`;
    el.style.top = `${posRef.current.y}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
  }
  // Switch from CSS bottom/right anchoring to absolute left/top on first grab.
  function ensurePos() {
    if (posRef.current || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    posRef.current = { x: r.left, y: r.top };
    applyPos();
  }

  function stopAnim() {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function react() {
    const now = Date.now();
    const t = throwRef.current;
    if (now - t.t > 5000) t.count = 0; // calm down after a quiet spell
    t.count += 1;
    t.t = now;
    const line = LINES[Math.min(t.count - 1, LINES.length - 1)];
    setMsg(line);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 2600);
  }

  function animate() {
    const p = posRef.current; if (!p) return;
    const v = velRef.current;
    const b = bounds();
    p.x += v.vx; p.y += v.vy;
    if (p.x < b.minX) { p.x = b.minX; v.vx = -v.vx * REST; }
    else if (p.x > b.maxX) { p.x = b.maxX; v.vx = -v.vx * REST; }
    if (p.y < b.minY) { p.y = b.minY; v.vy = -v.vy * REST; }
    else if (p.y > b.maxY) { p.y = b.maxY; v.vy = -v.vy * REST; }
    v.vx *= FRICTION; v.vy *= FRICTION;
    applyPos();
    if (Math.hypot(v.vx, v.vy) > 0.4) rafRef.current = requestAnimationFrame(animate);
    else rafRef.current = null;
  }

  function onPointerDown(e: React.PointerEvent) {
    stopAnim();
    ensurePos();
    draggingRef.current = true;
    movedRef.current = false;
    setDragging(true);
    setHovered(false);
    const p = posRef.current!;
    offsetRef.current = { dx: e.clientX - p.x, dy: e.clientY - p.y };
    lastRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    velRef.current = { vx: 0, vy: 0 };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || !posRef.current) return;
    const nx = e.clientX - offsetRef.current.dx;
    const ny = e.clientY - offsetRef.current.dy;
    if (Math.abs(e.clientX - (posRef.current.x + offsetRef.current.dx)) > MOVE_SLOP ||
        Math.abs(e.clientY - (posRef.current.y + offsetRef.current.dy)) > MOVE_SLOP) {
      movedRef.current = true;
    }
    posRef.current.x = nx; posRef.current.y = ny;
    clampPos();
    applyPos();
    // Track release velocity (px per frame ≈ px/ms * 16).
    const now = performance.now();
    const dt = now - lastRef.current.t;
    if (dt > 0) {
      velRef.current = {
        vx: ((e.clientX - lastRef.current.x) / dt) * 16,
        vy: ((e.clientY - lastRef.current.y) / dt) * 16,
      };
      lastRef.current = { x: e.clientX, y: e.clientY, t: now };
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (movedRef.current && Math.hypot(velRef.current.vx, velRef.current.vy) > THROW_SPEED) {
      react();
      stopAnim();
      rafRef.current = requestAnimationFrame(animate);
    }
  }
  function onClick() {
    if (movedRef.current) { movedRef.current = false; return; } // was a drag/throw, not a tap
    navigate({ to: "/ai-assistant" });
  }

  // Keep him on-screen if the window resizes; tidy up on unmount.
  useEffect(() => {
    function onResize() { clampPos(); applyPos(); }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      stopAnim();
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, []);

  return (
    <div ref={wrapRef} className="fixed bottom-6 right-6 z-50" style={{ width: SIZE, height: SIZE, touchAction: "none" }}>
      {/* Speech bubble — cheeky reaction takes priority over the hover tooltip */}
      <div
        className={cn(
          "absolute bottom-full right-0 mb-2 w-max max-w-[220px] rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-sm transition-all duration-200",
          (msg || (hovered && !dragging)) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none",
        )}
        style={{ background: "rgba(13,21,32,0.96)", border: `1px solid rgba(232,160,32,0.25)` }}
      >
        {msg ? (
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: COLORS.leoAmber, margin: 0 }}>
            {msg}
          </p>
        ) : (
          <>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: COLORS.leoAmber, margin: 0 }}>
              LEO AI AGENT
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, color: COLORS.muted, margin: "2px 0 0" }}>
              Drag &amp; throw me · tap to chat
            </p>
          </>
        )}
      </div>

      {/* Bubble button */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "group relative flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200",
          dragging ? "scale-105 cursor-grabbing" : "cursor-grab hover:scale-110",
        )}
        aria-label="Open Leo AI Agent (drag to move, throw to bounce)"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${COLORS.abyss}, ${COLORS.void})`,
          border: `1.5px solid rgba(232,160,32,0.55)`,
          boxShadow: hovered || dragging ? `0 6px 32px rgba(232,160,32,0.45)` : `0 4px 24px rgba(232,160,32,0.25)`,
        }}
      >
        {/* Rotating outer ring */}
        <svg className="absolute inset-0 h-full w-full animate-[spin_14s_linear_infinite] opacity-35" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="26" stroke={COLORS.leoAmber} strokeWidth="0.8" strokeDasharray="4 6" fill="none" />
        </svg>

        {/* Leo constellation mark */}
        <LeoIcon size={32} variant="leo" className="pointer-events-none drop-shadow-sm" />

        {/* Pulse ring */}
        <span className="pointer-events-none absolute inset-0 rounded-full animate-ping opacity-15" style={{ background: `rgba(232,160,32,0.3)` }} />
      </button>
    </div>
  );
}
