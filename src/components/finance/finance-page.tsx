import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DollarSign, RefreshCw, CheckCircle2, XCircle, FileText, FileCheck,
  Quote, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type FinanceTab = "invoices" | "proforma" | "quotations";

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>("invoices");
  const [connected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (!connected) {
      toast.error("Connect QuickBooks first");
      return;
    }
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1000));
    setSyncing(false);
    toast.success("Sync complete");
  }

  const TABS: {
    key: FinanceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    cols: string[];
  }[] = [
    {
      key: "invoices",
      label: "Invoices",
      icon: FileText,
      cols: ["#", "Customer / Vessel", "Date", "Due Date", "Amount", "Status"],
    },
    {
      key: "proforma",
      label: "Pro-Forma",
      icon: FileCheck,
      cols: ["#", "Customer / Vessel", "Date", "Expiry", "Amount", "Status"],
    },
    {
      key: "quotations",
      label: "Quotations",
      icon: Quote,
      cols: ["#", "Customer / Vessel", "Date", "Valid Until", "Amount", "Status"],
    },
  ];

  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/40 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Finance</div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Finance</h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
          className="gap-1.5"
        >
          {syncing
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          Sync from QuickBooks
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* QuickBooks connection card */}
        <div className="rounded-lg border border-border bg-card/60 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2CA01C]/10">
              <DollarSign className="h-5 w-5 text-[#2CA01C]" />
            </div>
            <div>
              <p className="text-sm font-semibold">QuickBooks Online</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {connected ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 h-7 text-xs"
                onClick={() => toast.info("Opening QuickBooks…")}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open QuickBooks
              </Button>
            )}
            <Button
              size="sm"
              variant={connected ? "outline" : "default"}
              className="h-7 text-xs"
              onClick={() => toast.info("QuickBooks OAuth integration — coming soon")}
            >
              {connected ? "Reconnect" : "Connect QuickBooks"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {activeTab.cols.map(col => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={activeTab.cols.length} className="px-3 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <activeTab.icon className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No {activeTab.label.toLowerCase()} yet.</p>
                    <p className="text-xs opacity-70">
                      Connect QuickBooks and sync to import records.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
