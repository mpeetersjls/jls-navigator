/**
 * One-time/maintenance upload of the UAE Arrival Instructions PDF into storage.
 *   POST /api/visa/upload-arrival-doc   (body = raw PDF bytes)
 * Upserts permit-documents/_assets/uae-arrival-instructions.pdf. Kept small so the
 * worker carries no embedded document. Re-POST to publish a new yearly revision.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VISA_ARRIVAL_DOC } from "@/lib/visa/arrival-instructions";

export async function visaUploadArrivalDocHandler(request: Request): Promise<Response> {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length < 1000) return json({ ok: false, error: "empty or too-small body" }, 400);
    const { error } = await (supabaseAdmin as any).storage
      .from(VISA_ARRIVAL_DOC.bucket)
      .upload(VISA_ARRIVAL_DOC.path, bytes, { contentType: VISA_ARRIVAL_DOC.contentType, upsert: true });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, bucket: VISA_ARRIVAL_DOC.bucket, path: VISA_ARRIVAL_DOC.path, bytes: bytes.length });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
}
