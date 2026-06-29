/**
 * Server-side helper: fetch the UAE Arrival Instructions from storage and return
 * it as an email attachment for sendEmail({ attachments: [...] }).
 *
 * IMPORTANT: when the "send visa to yacht/crew" email is built, this MUST always
 * be included so crew always receive the UAE arrival instructions.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VISA_ARRIVAL_DOC } from "./arrival-instructions";

export async function visaArrivalAttachment(): Promise<{ filename: string; contentBase64: string; contentType: string } | null> {
  const { data } = await (supabaseAdmin as any).storage.from(VISA_ARRIVAL_DOC.bucket).download(VISA_ARRIVAL_DOC.path);
  if (!data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { filename: VISA_ARRIVAL_DOC.filename, contentBase64: btoa(bin), contentType: VISA_ARRIVAL_DOC.contentType };
}
