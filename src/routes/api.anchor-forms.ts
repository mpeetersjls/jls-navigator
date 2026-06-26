/**
 * Anchor Digital Forms API — POST /api/anchor-forms (authenticated, bearer).
 * Actions:
 *   generate → save a submission + build a branded PDF (esign-documents/forms/<id>.pdf)
 *   email    → email the completed PDF link (from anchor@) to a recipient
 *   sign     → create an Anchor (e-Sign) document from the PDF and send it for signature
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildFormPdf } from "@/lib/anchor-forms/pdf.server";
import { getFormDef } from "@/lib/anchor-forms/definitions";
import { sendEmail } from "@/lib/ses.server";

const BUCKET = "esign-documents";
const ANCHOR_SENDER = process.env.ANCHOR_MAIL_SENDER ?? "anchor@jlsyachts.com";
const db = () => supabaseAdmin as any;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function signedUrl(path: string, expiresIn = 60 * 60 * 24 * 14): Promise<string> {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return (data?.signedUrl as string) ?? "";
}

export async function anchorFormsHandler(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);
  const { data: { user }, error: authErr } = await db().auth.getUser(auth.slice(7));
  if (authErr || !user) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await request.json(); } catch { /* allow empty */ }
  const action = body.action as string;

  try {
    // ── Generate: save submission + build PDF ──
    if (action === "generate") {
      const def = getFormDef(body.formKey);
      if (!def) return json({ ok: false, error: `Unknown form: ${body.formKey}` }, 400);
      const values = (body.values ?? {}) as Record<string, unknown>;

      const { data: sub, error } = await db().from("anchor_form_submissions").insert({
        form_key: def.key, title: def.title, values, status: "completed", created_by: user.id,
      }).select("id").single();
      if (error) return json({ ok: false, error: error.message }, 500);

      const pdfBytes = await buildFormPdf(def, values);
      const path = `forms/${sub.id}.pdf`;
      const { error: upErr } = await db().storage.from(BUCKET)
        .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (upErr) return json({ ok: false, error: `PDF upload failed: ${upErr.message}` }, 500);

      await db().from("anchor_form_submissions").update({ pdf_path: path, updated_at: new Date().toISOString() }).eq("id", sub.id);
      return json({ ok: true, submissionId: sub.id, pdfUrl: await signedUrl(path), emailTo: def.emailTo ?? null, title: def.title });
    }

    // ── Email: send the completed PDF link ──
    if (action === "email") {
      const { data: sub } = await db().from("anchor_form_submissions").select("*").eq("id", body.submissionId).maybeSingle();
      if (!sub?.pdf_path) return json({ ok: false, error: "Submission or PDF not found" }, 404);
      const to = String(body.to ?? "").trim();
      if (!to) return json({ ok: false, error: "Recipient email required" }, 400);
      const url = await signedUrl(sub.pdf_path);
      await sendEmail({
        from: ANCHOR_SENDER,
        to: [to],
        cc: body.cc ? [String(body.cc)] : [],
        subject: body.subject || `${sub.title}`,
        html: `<p>${body.message ? String(body.message).replace(/</g, "&lt;") + "<br><br>" : ""}Please find the completed <strong>${sub.title}</strong> here:</p><p><a href="${url}">Open document</a></p><p style="color:#94a3b8;font-size:12px;">Sent via Anchor · JLS Yachts</p>`,
        text: `${sub.title}\n\nOpen the document: ${url}`,
      });
      await db().from("anchor_form_submissions").update({ status: "emailed", updated_at: new Date().toISOString() }).eq("id", sub.id);
      return json({ ok: true });
    }

    // ── Sign: create an Anchor e-Sign document from the PDF + send it ──
    if (action === "sign") {
      const { data: sub } = await db().from("anchor_form_submissions").select("*").eq("id", body.submissionId).maybeSingle();
      if (!sub?.pdf_path) return json({ ok: false, error: "Submission or PDF not found" }, 404);
      const signerName = String(body.signerName ?? "").trim();
      const signerEmail = String(body.signerEmail ?? "").trim();
      if (!signerName || !signerEmail) return json({ ok: false, error: "Signer name and email required" }, 400);

      const token = (globalThis.crypto as any).randomUUID().replace(/-/g, "");
      const base = (process.env.VITE_APP_URL as string | undefined) ?? new URL(request.url).origin;
      const expires = new Date(Date.now() + 14 * 86400_000).toISOString();

      const { data: doc, error } = await db().from("esign_documents").insert({
        title: sub.title, file_path: sub.pdf_path, file_name: `${sub.title}.pdf`,
        signer_name: signerName, signer_email: signerEmail,
        status: "sent", signing_token: token, token_expires_at: expires,
        sent_at: new Date().toISOString(), created_by: user.id,
      }).select("id").single();
      if (error) return json({ ok: false, error: error.message }, 500);

      const link = `${base}/sign/${token}`;
      await sendEmail({
        from: ANCHOR_SENDER,
        to: [signerEmail],
        subject: `Signature requested: ${sub.title}`,
        html: `<p>Dear ${signerName.replace(/</g, "&lt;")},</p><p>You have a document waiting for your signature: <strong>${sub.title}</strong>.</p><p><a href="${link}">Review &amp; sign</a></p><p style="color:#94a3b8;font-size:12px;">This link expires in 14 days. JLS Yachts · Anchor</p>`,
        text: `You have a document to sign: ${sub.title}\nReview & sign: ${link}`,
      });
      try { await db().from("esign_events").insert([{ document_id: doc.id, event: "sent", actor: user.email ?? "anchor" }]); } catch { /* non-fatal */ }
      await db().from("anchor_form_submissions").update({ status: "sent_for_signature", esign_document_id: doc.id, updated_at: new Date().toISOString() }).eq("id", sub.id);
      return json({ ok: true, documentId: doc.id });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "Anchor forms action failed" }, 500);
  }
}
