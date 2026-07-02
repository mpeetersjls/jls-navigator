import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { useAuth } from "@/lib/auth";
import { doSendForSignature } from "@/lib/esign.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Loader2, FileText, Download, Send, Ban, Mail, Eye, CheckCircle2,
  Clock, FileSignature, Link2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ESIGN_STATUS_LABEL, ESIGN_STATUS_COLOR, ESIGN_EVENT_LABEL } from "./esign-meta";
import { useSignedUrl } from "@/lib/signed-url";
import { SignedAnchor } from "@/components/ui/signed-file";

type Doc = {
  id: string; reference: string | null; title: string; description: string | null;
  file_path: string; file_name: string | null; signed_file_path: string | null;
  signer_name: string; signer_email: string; message: string | null; status: string;
  signing_token: string | null; token_expires_at: string | null;
  sent_at: string | null; viewed_at: string | null; signed_at: string | null;
  declined_reason: string | null; created_at: string;
  signature_fields?: any[] | null;
};
type Event = { id: string; event: string; actor: string | null; ip_address: string | null; created_at: string };

const EVENT_ICON: Record<string, React.ReactNode> = {
  created: <FileText className="h-3.5 w-3.5" />, sent: <Mail className="h-3.5 w-3.5" />,
  viewed: <Eye className="h-3.5 w-3.5" />, signed: <CheckCircle2 className="h-3.5 w-3.5" />,
  declined: <XCircle className="h-3.5 w-3.5" />, voided: <Ban className="h-3.5 w-3.5" />,
};
const dt = (d: string | null) => d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function EsignDetailPage({ documentId, onBack }: { documentId: string; onBack?: () => void }) {
  const navigate = useNavigate();
  const back = onBack ?? (() => navigate({ to: "/esign" }));
  const { user } = useAuth();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileUrl = useSignedUrl(doc?.file_path, "esign-documents");
  const signedFileUrl = useSignedUrl(doc?.signed_file_path, "esign-documents");

  useEffect(() => { void load(); }, [documentId]);

  async function load() {
    setLoading(true);
    const [dRes, eRes] = await Promise.all([
      (supabase as any).from("esign_documents").select("*").eq("id", documentId).maybeSingle(),
      fetchAllRows(() => (supabase as any).from("esign_events").select("*").eq("document_id", documentId).order("created_at", { ascending: false })),
    ]);
    if (dRes.error || !dRes.data) { toast.error("Document not found"); back(); return; }
    setDoc(dRes.data as Doc);
    setEvents((eRes.data ?? []) as Event[]);
    setLoading(false);
  }

  async function resend() {
    if (!doc) return;
    setBusy(true);
    try { await doSendForSignature({ data: { documentId: doc.id, senderEmail: user?.email } } as any); toast.success(`Sent to ${doc.signer_email}`); void load(); }
    catch (e: any) { toast.error(e.message ?? "Send failed"); } finally { setBusy(false); }
  }
  async function voidDoc() {
    if (!doc || !confirm("Void this document? The signing link will stop working.")) return;
    const { error } = await (supabase as any).from("esign_documents").update({ status: "voided" }).eq("id", doc.id);
    if (error) toast.error(error.message);
    else { await (supabase as any).from("esign_events").insert([{ document_id: doc.id, event: "voided", actor: user?.email }]); toast.success("Document voided"); void load(); }
  }
  function copyLink() {
    if (!doc?.signing_token) return;
    navigator.clipboard.writeText(`${window.location.origin}/sign/${doc.signing_token}`);
    toast.success("Signing link copied");
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!doc) return null;

  const canSend = ["draft", "sent", "viewed", "expired"].includes(doc.status);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-card/40 px-6 py-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => back()} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"><ArrowLeft className="h-4 w-4" /> Documents</button>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono text-xs text-muted-foreground">{doc.reference ?? "—"}</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-xl font-bold">{doc.title}</h1>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold", ESIGN_STATUS_COLOR[doc.status] ?? "bg-muted text-muted-foreground")}>{ESIGN_STATUS_LABEL[doc.status] ?? doc.status}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">For {doc.signer_name} · {doc.signer_email}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {doc.signing_token && doc.status !== "voided" && doc.status !== "signed" && (
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Copy link</Button>
            )}
            {canSend && <Button size="sm" onClick={resend} disabled={busy} className="gap-1.5">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{doc.status === "draft" ? "Send" : "Resend"}</Button>}
            {doc.status !== "signed" && doc.status !== "voided" && <Button variant="ghost" size="sm" onClick={voidDoc} className="gap-1.5 text-destructive/70 hover:text-destructive"><Ban className="h-3.5 w-3.5" /> Void</Button>}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
          {doc.declined_reason && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">Declined: {doc.declined_reason}</div>}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5"><SignedAnchor stored={doc.file_path} bucket="esign-documents"><FileText className="h-3.5 w-3.5" /> Original PDF</SignedAnchor></Button>
            {doc.signed_file_path && <Button variant="outline" size="sm" asChild className="gap-1.5"><SignedAnchor stored={doc.signed_file_path} bucket="esign-documents"><Download className="h-3.5 w-3.5" /> Signed PDF</SignedAnchor></Button>}
          </div>

          {/* Signature field placement — editable until the document is signed */}
          <SignatureFieldsEditor doc={doc} onSaved={load} />

          {/* Inline preview of the relevant PDF */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <iframe title="Document" src={(signedFileUrl || fileUrl) || undefined} className="h-[60vh] w-full border-0" />
          </div>
        </div>

        {/* Audit rail */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card/20 px-5 py-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><FileSignature className="h-4 w-4 text-primary/70" /> Audit trail</h3>
          <div className="space-y-3">
            <Stamp icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={dt(doc.created_at)} />
            <Stamp icon={<Mail className="h-3.5 w-3.5" />} label="Sent" value={dt(doc.sent_at)} />
            <Stamp icon={<Eye className="h-3.5 w-3.5" />} label="Viewed" value={dt(doc.viewed_at)} />
            <Stamp icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Signed" value={dt(doc.signed_at)} />
          </div>

          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">Event log</div>
            <div className="space-y-3">
              {events.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
              {events.map(ev => (
                <div key={ev.id} className="flex gap-2.5 text-xs">
                  <div className="mt-0.5 text-muted-foreground/70">{EVENT_ICON[ev.event] ?? <Clock className="h-3.5 w-3.5" />}</div>
                  <div className="min-w-0">
                    <div className="font-medium">{ESIGN_EVENT_LABEL[ev.event] ?? ev.event}</div>
                    <div className="text-muted-foreground">{dt(ev.created_at)}</div>
                    {ev.actor && <div className="truncate text-muted-foreground/70">{ev.actor}</div>}
                    {ev.ip_address && <div className="text-muted-foreground/50">IP {ev.ip_address}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stamp({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="text-muted-foreground/60">{icon}</div>
      <div className="w-14 text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

// ── Signature field editor — place client + company signatures on the document ──
type SigField = { page: number; pos: string; role: "client" | "company"; signatory_id?: string; signatory_name?: string };
const SIG_POSITIONS = ["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "middle-center"];

function SignatureFieldsEditor({ doc, onSaved }: { doc: Doc; onSaved: () => void }) {
  const locked = doc.status === "signed" || doc.status === "voided" || doc.status === "declined";
  const [fields, setFields] = useState<SigField[]>(() =>
    (Array.isArray(doc.signature_fields) ? doc.signature_fields : []).map((f: any) => ({
      page: Number(f.page ?? 1), pos: String(f.pos ?? "bottom-right"),
      role: f.role === "company" ? "company" : "client",
      signatory_id: f.signatory_id, signatory_name: f.signatory_name,
    })),
  );
  const [signatories, setSignatories] = useState<{ id: string; full_name: string; signature_path: string | null }[]>([]);
  const [addRole, setAddRole] = useState<"client" | "company">("client");
  const [addSignatory, setAddSignatory] = useState("");
  const [addPage, setAddPage] = useState("1");
  const [addPos, setAddPos] = useState("bottom-right");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (supabase as any).from("jls_signatories").select("id, full_name, signature_path").order("full_name")
      .then(({ data }: any) => setSignatories(data ?? []));
  }, []);

  function addField() {
    const sig = signatories.find((s) => s.id === addSignatory);
    if (addRole === "company" && !sig) { toast.error("Pick the company signatory"); return; }
    if (addRole === "company" && !sig?.signature_path) { toast.error(`${sig?.full_name} has no signature image uploaded (Anchor → Signatories)`); return; }
    setFields((f) => [...f, {
      page: Math.max(1, Number(addPage) || 1), pos: addPos, role: addRole,
      ...(addRole === "company" ? { signatory_id: sig!.id, signatory_name: sig!.full_name } : {}),
    }]);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("esign_documents")
        .update({ signature_fields: fields, updated_at: new Date().toISOString() }).eq("id", doc.id);
      if (error) throw error;
      toast.success("Signature fields saved");
      setDirty(false);
      onSaved();
    } catch (e: any) { toast.error(String(e?.message ?? e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileSignature className="h-4 w-4 text-primary/70" /> Signature fields
        </h3>
        {dirty && !locked && (
          <Button size="sm" onClick={save} disabled={saving} className="h-7 gap-1.5 text-xs">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save fields
          </Button>
        )}
      </div>
      <p className="mb-3 text-[11.5px] text-muted-foreground">
        Where signatures are stamped when the document is signed — the client's drawn signature, and/or a JLS company signatory's stored signature.
        {locked && " (Locked — the document is finalised.)"}
      </p>

      {fields.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground/70">No fields yet — the signature will only appear on the certificate page.</p>
      ) : (
        <div className="mb-3 space-y-1.5">
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs">
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                f.role === "company" ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-500",
              )}>
                {f.role === "company" ? `Company · ${f.signatory_name ?? "signatory"}` : "Client"}
              </span>
              <span className="text-muted-foreground">Page {f.page}</span>
              <span className="capitalize text-muted-foreground">{f.pos.replace("-", " ")}</span>
              {!locked && (
                <button
                  onClick={() => { setFields((all) => all.filter((_, x) => x !== i)); setDirty(true); }}
                  className="ml-auto rounded p-0.5 text-muted-foreground/60 hover:text-destructive"
                  title="Remove this field"
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!locked && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border/70 p-2.5">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Who signs</div>
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as "client" | "company")}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs">
              <option value="client">Client (the signer)</option>
              <option value="company">Company signatory (JLS)</option>
            </select>
          </div>
          {addRole === "company" && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Signatory</div>
              <select value={addSignatory} onChange={(e) => setAddSignatory(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                <option value="">Select…</option>
                {signatories.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}{s.signature_path ? "" : " (no signature image)"}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Page</div>
            <Input type="number" min={1} value={addPage} onChange={(e) => setAddPage(e.target.value)} className="h-8 w-16 text-xs" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Position</div>
            <select value={addPos} onChange={(e) => setAddPos(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs">
              {SIG_POSITIONS.map((p) => <option key={p} value={p}>{p.replace("-", " ")}</option>)}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={addField} className="h-8 gap-1 text-xs">
            <FileSignature className="h-3 w-3" /> Add field
          </Button>
        </div>
      )}
    </div>
  );
}
