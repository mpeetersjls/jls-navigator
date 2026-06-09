import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eraser, PenLine, Type } from "lucide-react";

// Captures a signature as a PNG data URL — either drawn on a canvas or typed
// (rendered to a canvas in a script-style font). Calls onChange with the data
// URL, or null when cleared.
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  // ── draw mode ──
  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    hasInk.current = true;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) onChange(canvasRef.current!.toDataURL("image/png"));
  }
  function clearDraw() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false; onChange(null);
  }

  // ── type mode ──
  useEffect(() => {
    if (mode !== "type") return;
    if (!typed.trim()) { onChange(null); return; }
    const c = document.createElement("canvas");
    c.width = 600; c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0f172a";
    ctx.font = "italic 64px 'Brush Script MT','Segoe Script',cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typed.trim(), 20, 100);
    onChange(c.toDataURL("image/png"));
  }, [typed, mode]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant={mode === "draw" ? "default" : "outline"} onClick={() => { setMode("draw"); onChange(null); }} className="h-8 gap-1.5 text-xs">
          <PenLine className="h-3.5 w-3.5" /> Draw
        </Button>
        <Button type="button" size="sm" variant={mode === "type" ? "default" : "outline"} onClick={() => { setMode("type"); setTyped(""); onChange(null); }} className="h-8 gap-1.5 text-xs">
          <Type className="h-3.5 w-3.5" /> Type
        </Button>
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
            className="h-40 w-full touch-none rounded-lg border border-border bg-white"
          />
          <button type="button" onClick={clearDraw} className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-white/90 px-2 py-1 text-[11px] text-slate-600 hover:bg-white">
            <Eraser className="h-3 w-3" /> Clear
          </button>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">Sign above using your mouse or finger</p>
        </div>
      ) : (
        <div>
          <Input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type your full name" className="h-10" />
          {typed.trim() && (
            <div className={cn("mt-2 flex h-24 items-center justify-center rounded-lg border border-border bg-white text-4xl text-slate-900")} style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive", fontStyle: "italic" }}>
              {typed.trim()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
