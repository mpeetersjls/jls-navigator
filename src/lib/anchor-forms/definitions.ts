/**
 * Anchor — Digital Forms definitions (schema-driven).
 *
 * Each form is a definition (sections + typed fields, with optional Arabic labels
 * for the bilingual DMA templates). A generic renderer fills it in-browser; on
 * completion the server generates a branded PDF from these definitions + values,
 * which can be downloaded, emailed, or sent into Anchor's e-signature flow.
 *
 * v1 forms: DMA Notice of Arrival, DMA Notice of Departure, Agency Appointment
 * Letter. (DMA CF12a permit is a follow-up; the Tariff Sheet is a reference doc.)
 */

export type FieldType =
  | "text" | "textarea" | "date" | "time" | "number" | "email" | "select";

export interface FormField {
  key: string;
  label: string;
  labelAr?: string;      // Arabic label (bilingual DMA forms)
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];    // for select
  full?: boolean;        // span full width in the fill UI
}

export interface FormSection {
  title?: string;
  fields: FormField[];
}

export interface FormDef {
  key: string;
  title: string;
  description: string;
  category: string;
  /** Pre-fill the email recipient when emailing the completed form. */
  emailTo?: string;
  /** Short instruction shown at the top of the form + on the PDF. */
  intro?: string;
  /** Letter-style forms: prose body with {{field}} placeholders (rendered as a
   *  letter on the PDF instead of a field table). */
  bodyTemplate?: string;
  sections: FormSection[];
}

const vesselCore: FormField[] = [
  { key: "vessel_name", label: "Vessel's Name", labelAr: "اسم الوسيلة البحرية", type: "text", required: true },
  { key: "vessel_flag", label: "Vessel's Flag", labelAr: "علم الوسيلة البحرية", type: "text", required: true },
  { key: "loa", label: "Vessel's L.O.A (m)", labelAr: "طول الوسيلة البحرية", type: "text" },
  { key: "imo", label: "IMO Number", labelAr: "رقم التسجيل", type: "text" },
  { key: "mmsi", label: "MMSI Number (AIS)", labelAr: "رقم MMSI", type: "text" },
  { key: "persons_onboard", label: "Total Persons Onboard", labelAr: "عدد الأشخاص على متنها", type: "number" },
];

const agentBlock: FormField[] = [
  { key: "agent_details", label: "Maritime Agent Details", labelAr: "بيانات الوكيل الملاحي", type: "textarea", full: true },
  { key: "contact_number", label: "Contact Number", labelAr: "رقم التواصل", type: "text" },
  { key: "email", label: "Email", labelAr: "البريد الإلكتروني", type: "email" },
];

export const ANCHOR_FORMS: FormDef[] = [
  {
    key: "dma-notice-of-arrival",
    title: "DMA — Notice of Arrival",
    description: "Notice of Arrival for vessels engaged in international voyages.",
    category: "DMA / Port Operations",
    emailTo: "sail@pcfc.ae",
    intro:
      "To be duly completed by the Approved Maritime Agent and sent at least 24 hours in advance.",
    sections: [
      {
        title: "Arrival Notification Details",
        fields: [
          ...vesselCore,
          { key: "last_port", label: "Last Port/Marina of Call", labelAr: "الميناء/المكان القادمة منه", type: "text" },
          { key: "eta_date", label: "Estimated Date of Arrival", labelAr: "تاريخ الوصول المتوقع", type: "date" },
          { key: "eta_time", label: "Estimated Time of Arrival", labelAr: "وقت الوصول المتوقع", type: "time" },
          { key: "marina_arrival", label: "Marina/Port of Arrival", labelAr: "المرسى/ميناء الوصول", type: "text" },
          { key: "berth", label: "Berth Number", labelAr: "رقم الرصيف", type: "text" },
          { key: "purpose", label: "Purpose of Entry", labelAr: "غرض الزيارة/الدخول", type: "textarea", full: true },
          { key: "duration", label: "Expected Duration of Stay", labelAr: "وقت المكوث المتوقع", type: "text" },
        ],
      },
      { title: "Maritime Agent", fields: agentBlock },
    ],
  },
  {
    key: "dma-notice-of-departure",
    title: "DMA — Notice of Departure",
    description: "Notice of Departure for vessels engaged in international voyages.",
    category: "DMA / Port Operations",
    emailTo: "sail@pcfc.ae",
    intro:
      "To be duly completed by the Approved Maritime Agent and sent at least 24 hours in advance.",
    sections: [
      {
        title: "Departure Notification Details",
        fields: [
          ...vesselCore,
          { key: "etd_date", label: "Estimated Date of Departure", labelAr: "تاريخ المغادرة المتوقع", type: "date" },
          { key: "etd_time", label: "Estimated Time of Departure", labelAr: "وقت المغادرة المتوقع", type: "time" },
          { key: "marina_departure", label: "Marina/Port of Departure", labelAr: "المرسى/ميناء المغادرة", type: "text" },
          { key: "berth", label: "Berth Number", labelAr: "رقم الرصيف", type: "text" },
          { key: "next_destination", label: "Next Destination of Call", labelAr: "الوجهة التالية", type: "text" },
        ],
      },
      { title: "Maritime Agent", fields: agentBlock },
    ],
  },
  {
    key: "agency-appointment-letter",
    title: "Agency Appointment Letter",
    description: "Authorisation appointing JLS Yachts LLC as UAE agent for a vessel.",
    category: "Agency",
    bodyTemplate:
      "{{letter_date}}\n\nThe Manager\nCc: General Directorate of Residency and Foreigners Affairs, Federal Transport Authority, & UAE Coast Guard\nUnited Arab Emirates\n\nDear Sir,\n\nM/Y “{{vessel_name}}” – IMO NO. {{imo}}\nAGENT APPOINTMENT LETTER / AUTHORIZATION LETTER\n\nWe do hereby authorize JLS Yachts LLC as our agent in the United Arab Emirates. JLS Yachts LLC will liaise, arrange and complete all necessary documentations, procedures and formalities not limited to the UAE Immigration clearances, Customs, Coast Guard formalities, Health Authority, Port Authorities, all official matters related to the Yacht with the Federal Transport Authority of the UAE, including sailing permit applications for “{{vessel_name}}”.\n\nWe hope that you would provide all necessary assistance to our agent.\n\nThank you.\n\nSincerely,\n\n{{signatory_name}}\n{{signatory_title}}",
    sections: [
      {
        title: "Letter Details",
        fields: [
          { key: "letter_date", label: "Letter Date", type: "date", required: true },
          { key: "vessel_name", label: "Vessel Name", type: "text", required: true },
          { key: "imo", label: "IMO Number", type: "text", required: true },
          { key: "signatory_name", label: "Signatory Name", type: "text", required: true },
          { key: "signatory_title", label: "Signatory Title / Position", type: "text", placeholder: "e.g. Owner's Representative" },
        ],
      },
    ],
  },
];

export function getFormDef(key: string): FormDef | undefined {
  return ANCHOR_FORMS.find((f) => f.key === key);
}
