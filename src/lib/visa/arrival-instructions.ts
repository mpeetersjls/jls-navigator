/**
 * UAE Arrival Instructions for Yacht Crew Visa — the standard one-pager that MUST
 * accompany every crew visa sent to a yacht, and is always part of the Visa
 * Document Bundle. Stored once in Supabase Storage (public permit-documents bucket)
 * and fetched at runtime, so it never bloats the worker/client bundles.
 *
 * To update (e.g. a new yearly revision): POST the new PDF to
 * /api/visa/upload-arrival-doc (it upserts the same path).
 */
export const VISA_ARRIVAL_DOC = {
  bucket: "permit-documents",
  path: "_assets/uae-arrival-instructions.pdf",
  /** "<bucket>/<path>" storage ref (resolveSignedUrl-compatible). */
  ref: "permit-documents/_assets/uae-arrival-instructions.pdf",
  filename: "UAE Arrival Instructions - Yacht Crew Visa.pdf",
  label: "UAE Arrival Instructions",
  contentType: "application/pdf",
} as const;
export default VISA_ARRIVAL_DOC;
