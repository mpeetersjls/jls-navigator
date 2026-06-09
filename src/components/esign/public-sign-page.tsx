import { useState, useEffect } from "react";
import { Route } from "@/routes/sign.$token";
import { getSigningDocument, doSubmitSignature, doDeclineSignature } from "@/lib/esign.server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "./signature-pad";
import { Loader2, FileSignature, CheckCircle2, XCircle, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";

type Loaded = {
  title: string; description: string | null; reference: string | null;
  signerName: string; message: string | null; status: string;
  fileUrl: string; signedFileUrl: string | null;
};

export function PublicSignPage() {
  const { token } = Route.useParams();
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | "signed" | "declined">(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => { void load(); }, [token]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const d = await getSigningDocument({ data: { token } } as any) as Loaded;
      setDoc(d);
      if (d.status === "signed") { setDone("signed"); setSignedUrl(d.signedFileUrl); }
      if (d.status === "declined") setDone("declined");
    } catch (e: any) { setError(e?.message ?? "This signing link is invalid."); }
    finally { setLoading(false); }
  }

  async function submit() {
    if (!sig) { toast.error("Please add your signature"); return; }
    if (!agreed) { toast.error("Please confirm you agree to sign electronically"); return; }
    setSubmitting(true);
    try {
      const res = await doSubmitSignature({ data: { token, signatureDataUrl: sig, typedName: doc?.signerName } } as any) as { signedFileUrl: string };
      setSignedUrl(res.signedFileUrl); setDone("signed");
    } catch (e: any) { toast.error(e?.message ?? "Could not submit signature"); }
    finally { setSubmitting(false); }
  }

  async function decline() {
    setSubmitting(true);
    try { await doDeclineSignature({ data: { token, reason: reason.trim() || undefined } } as any); setDone("declined"); }
    catch (e: any) { toast.error(e?.message ?? "Could not decline"); }
    finally { setSubmitting(false); setDeclineOpen(false); }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-[#0f172a] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <FileSignature className="h-5 w-5" />
          <span className="font-semibold">JLS Yachts · Aquila One</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <XCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
            <h1 className="font-semibold text-lg">Link unavailable</h1>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </div>
        ) : done === "signed" ? (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
            <h1 className="font-semibold text-lg">Thank you — signed!</h1>
            <p className="mt-1 text-sm text-slate-500">Your signature has been recorded{doc?.reference ? ` for ${doc.reference}` : ""}. A copy has been emailed to you.</p>
            {signedUrl && <Button asChild className="mt-4 gap-1.5"><a href={signedUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> Download signed copy</a></Button>}
          </div>
        ) : done === "declined" ? (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <XCircle className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <h1 className="font-semibold text-lg">Signing declined</h1>
            <p className="mt-1 text-sm text-slate-500">You've declined to sign this document. You can close this window.</p>
          </div>
        ) : doc ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">{doc.reference ?? "Document"}</div>
              <h1 className="mt-0.5 text-xl font-bold">{doc.title}</h1>
              <p className="mt-1 text-sm text-slate-500">Hello {doc.signerName}, please review the document below and sign.</p>
              {doc.message && <p className="mt-3 border-l-2 border-blue-600 pl-3 text-sm text-slate-600">{doc.message}</p>}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <iframe title="Document to sign" src={doc.fileUrl} className="h-[65vh] w-full border-0" />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Your signature</h2>
              <SignaturePad onChange={setSig} />
              <label className="mt-4 flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />
                <span>I agree to sign this document electronically, and I consent to my signature, name, IP address and timestamp being recorded as evidence of signing.</span>
              </label>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button variant="ghost" className="text-slate-500 hover:text-red-600" onClick={() => setDeclineOpen(true)} disabled={submitting}>Decline</Button>
                <Button onClick={submit} disabled={submitting || !sig || !agreed} className="gap-1.5">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Sign document
                </Button>
              </div>
            </div>

            {declineOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeclineOpen(false)}>
                <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold">Decline to sign?</h3>
                  <p className="mt-1 text-sm text-slate-500">Optionally tell us why.</p>
                  <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className="mt-3 resize-none" placeholder="Reason (optional)" />
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={submitting}>Cancel</Button>
                    <Button onClick={decline} disabled={submitting} className="bg-red-600 hover:bg-red-700 gap-1.5">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Decline</Button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-slate-400">Signed electronically via the Aquila One platform. Do not share this link.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
