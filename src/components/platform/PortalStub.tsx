import { PolarisShell } from "@/components/platform/PolarisShell";
import { Construction } from "lucide-react";

/** Placeholder portal page for modules not yet built out (#144). */
export function PortalStub({ label, title, blurb }: { label: string; title: string; blurb: string }) {
  return (
    <PolarisShell label={label} title={title}>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
        <Construction className="h-9 w-9 text-muted-foreground/50" />
        <div>
          <p className="font-display text-base font-semibold">Coming soon</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
    </PolarisShell>
  );
}
