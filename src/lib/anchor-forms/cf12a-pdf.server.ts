/**
 * DMA CF12a — "Application for Foreign-Flagged Visiting Vessel Permit".
 *
 * This is an official PCFC/DMA fillable PDF (bilingual EN/AR AcroForm). Rather than
 * recreate it, we fill the authority's own form: we write the data Polaris holds
 * (vessel registration + dimensions + owner/agent/insurance basics) into the matching
 * text fields and leave the form **interactive** so the user can tick the permit-type /
 * application-type / entry-method checkboxes and complete the rest by hand before
 * printing or submitting. We never auto-tick checkboxes on a government form.
 *
 * Field names in the template are generic (Text1…Text83); the map below was derived by
 * stamping each field with its own name and reading the rendered layout.
 */
import { PDFDocument } from "pdf-lib";
import { CF12A_TEMPLATE_B64 } from "./cf12a-template";

// form field key → AcroForm text-field name in the CF12a template
const FIELD_MAP: Record<string, string> = {
  date_of_application: "Text1",
  // Marine Vessel Registration Details
  vessel_type: "Text9",
  imo: "Text5", // License No./(IMO) No.
  hull_id: "Text10",
  vessel_name: "Text6",
  year_build: "Text11",
  vessel_flag: "Text7",
  max_passengers: "Text12",
  crew_count: "Text8",
  // Marine Vessel Details
  loa: "Text13", // Length (m)
  depth: "Text14",
  hull_material: "Text15",
  gross_tonnage: "Text16",
  beam: "Text17",
  draft: "Text18",
  hull_color: "Text19",
  // Engine (the "Other" free-text boxes; checkboxes are ticked by hand)
  propulsion_other: "Text20",
  fuel_other: "Text21",
  // Owner & contact
  owner_name: "Text22",
  owner_nationality: "Text23",
  captain_name: "Text40",
  owner_mobile: "Text41",
  owner_email: "Text42",
  // Shipping agent
  agent_name: "Text43",
  agent_phone: "Text44",
  agent_license: "Text45",
  // Shipping broker
  broker_company: "Text46",
  broker_code: "Text47",
  bill_of_lading: "Text48",
  // Insurance
  insurance_company: "Text74",
  insurance_type: "Text75",
  insurance_policy_no: "Text76",
  insurance_expiry: "Text77",
  // UAE entry / departure
  last_port: "Text78",
  entry_port: "Text79",
  uae_entry_date: "Text80",
  uae_departure_date: "Text81",
  // Declaration
  declaration_date: "Text82",
  applicant_name: "Text83",
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fill the official CF12a PDF from form values. Returns the (still-fillable) PDF bytes. */
export async function generateCf12aPdf(values: Record<string, unknown>): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(b64ToBytes(CF12A_TEMPLATE_B64), { ignoreEncryption: true });
  const form = pdf.getForm();
  for (const [key, fieldName] of Object.entries(FIELD_MAP)) {
    const raw = values[key];
    if (raw == null || String(raw).trim() === "") continue;
    try {
      const tf = form.getTextField(fieldName);
      tf.setText(String(raw));
    } catch {
      /* field missing/wrong type — skip */
    }
  }
  // Leave the form interactive (do not flatten) so the user can tick the
  // permit-type / application-type / entry-method checkboxes and edit anything.
  return await pdf.save();
}
