import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMfaStatus, enrollTotp, verifyTotp, unenrollTotp, ENFORCE_MFA,
  type EnrollResult,
} from "@/lib/auth/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldAlert, Loader2, Copy, Check, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

export function MfaSetup() {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: getMfaStatus,
  });

  const [enroll, setEnroll] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  async function startEnroll() {
    setBusy(true);
    try {
      setEnroll(await enrollTotp());
      setCode("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not start enrolment");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enroll || code.trim().length < 6) return;
    setBusy(true);
    try {
      await verifyTotp(enroll.factorId, code);
      toast.success("Two-factor authentication enabled");
      setEnroll(null);
      setCode("");
      refetch();
    } catch {
      toast.error("That code didn't match — check your authenticator and try again");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (enroll) { try { await unenrollTotp(enroll.factorId); } catch { /* ignore */ } }
    setEnroll(null);
    setCode("");
    refetch();
  }

  async function remove(factorId: string) {
    setBusy(true);
    try {
      await unenrollTotp(factorId);
      toast.success("Authenticator removed");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove");
    } finally {
      setBusy(false);
      setRemoveId(null);
    }
  }

  // Clean up an abandoned half-finished enrolment if the component unmounts.
  useEffect(() => () => { if (enroll) { unenrollTotp(enroll.factorId).catch(() => {}); } }, [enroll]);

  const enrolled = status?.enrolled ?? false;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add two-factor authentication (2FA) to protect your account.
        </p>
      </div>

      {/* Status banner */}
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${
        enrolled ? "border-emerald-500/25 bg-emerald-500/10" : "border-amber-500/25 bg-amber-500/10"
      }`}>
        {enrolled
          ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
          : <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />}
        <div className="text-sm">
          <div className="font-medium">{enrolled ? "Two-factor authentication is on" : "Two-factor authentication is off"}</div>
          <p className="mt-0.5 text-muted-foreground">
            {enrolled
              ? "Your account asks for a code from your authenticator app when signing in."
              : ENFORCE_MFA
                ? "It will soon be required. Enrol now to avoid interruption."
                : "Recommended. It's optional for now, but strongly encouraged."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Existing factors */}
          {status && status.factors.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              {status.factors.map((f) => (
                <div key={f.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.friendlyName || "Authenticator app"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.status === "verified" ? "Active" : "Pending"}{fmt(f.createdAt) ? ` · added ${fmt(f.createdAt)}` : ""}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    f.status === "verified" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}>{f.status === "verified" ? "Verified" : "Unverified"}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-destructive"
                    onClick={() => setRemoveId(f.id)} disabled={busy}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Enrolment flow */}
          {!enroll ? (
            <Button onClick={startEnroll} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {enrolled ? "Add another authenticator" : "Set up authenticator app"}
            </Button>
          ) : (
            <div className="rounded-xl border border-border p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">1. Scan this QR code</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use Google Authenticator, Microsoft Authenticator, 1Password, or any TOTP app.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <img src={enroll.qrCodeSvg} alt="MFA QR code" className="h-40 w-40 rounded-lg bg-white p-2" />
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">Or enter this key manually</Label>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 rounded-md bg-muted px-2.5 py-1.5 font-mono text-[12px] break-all">{enroll.secret}</code>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0"
                      onClick={() => { navigator.clipboard?.writeText(enroll.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">2. Enter the 6-digit code</h2>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && confirmEnroll()}
                  placeholder="123456"
                  inputMode="numeric"
                  autoFocus
                  className="h-10 max-w-[160px] font-mono text-lg tracking-[0.3em]"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={confirmEnroll} disabled={busy || code.length < 6} className="gap-1.5">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify &amp; enable
                </Button>
                <Button variant="ghost" onClick={cancelEnroll} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this authenticator?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer be asked for a code from it when signing in. You can set one up again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeId && remove(removeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
