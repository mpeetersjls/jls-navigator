import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Radar, RefreshCw, ExternalLink, Loader2, Info } from "lucide-react";

// VesselFinder "My Fleet" embed. The Fleet key is a PUBLIC embed key (designed
// to live in client HTML), not the paid AIS userkey — so this is safe client-side.
// Shows the vessels added to the JLS fleet in VesselFinder (plan limit applies).
const FLEET_KEY = "06acadd6114f956166f3d1065e694dc0";
const FLEET_NAME = "JLS Yachts LLC";

// Run the VesselFinder aismap.js embed inside an isolated iframe via srcDoc.
const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{height:100%;margin:0;background:#aadaff}#vesselfinder,iframe{height:100%!important;width:100%!important;border:0}</style>
</head><body>
<script type="text/javascript">
  var width="100%"; var height="100%";
  var latitude="25.0"; var longitude="55.3"; var zoom="7";
  var names=true; var fleet="${FLEET_KEY}"; var fleet_name="${FLEET_NAME}"; var fleet_timespan="1440";
</script>
<script type="text/javascript" src="https://www.vesselfinder.com/aismap.js"></script>
</body></html>`;

export function MyFleetPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/70 bg-card/30 px-6 py-3.5">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">Vessel Tracking</div>
          <h1 className="mt-0.5 flex items-center gap-2 font-display text-[1.25rem] font-semibold tracking-tight">
            <Radar className="h-4 w-4 text-primary/80" /> My Fleet
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={() => { setLoaded(false); setReloadKey(k => k + 1); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" asChild>
            <a href={`https://www.vesselfinder.com/?fleet=${FLEET_KEY}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Open in VesselFinder
            </a>
          </Button>
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
            <p className="text-sm text-muted-foreground">Loading live vessel positions…</p>
            <p className="text-xs text-muted-foreground/50">Powered by VesselFinder AIS</p>
          </div>
        )}
        <iframe
          key={reloadKey}
          title="My Fleet — VesselFinder"
          srcDoc={srcDoc}
          className="h-full w-full border-0"
          onLoad={() => setLoaded(true)}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-border/40 bg-muted/10 px-6 py-2">
        <Info className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        <span className="text-[11px] text-muted-foreground/60">
          Live AIS positions of vessels in the JLS VesselFinder fleet. Per-vessel live-location columns and underway/arrived
          timestamps on Vessel Overview require the paid VesselFinder Fleet Positions API.
        </span>
      </div>
    </div>
  );
}
