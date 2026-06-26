/**
 * Anchor Digital Forms — server-side PDF generation (pdf-lib).
 * Builds a clean, branded A4 PDF from a form definition + submitted values.
 * Field forms render as a titled label/value layout; letter-style forms
 * (bodyTemplate) render the merged prose. English output for v1.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FormDef } from "./definitions";

const GOLD = rgb(0.27, 0.56, 0.73); // Dodger Blue (brand interactive)
const INK = rgb(0.1, 0.12, 0.16);
const GREY = rgb(0.42, 0.46, 0.52);

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export async function buildFormPdf(def: FormDef, values: Record<string, unknown>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595, H = 842, margin = 50;
  const maxW = W - margin * 2;
  let page = pdf.addPage([W, H]);
  let y = H - margin;

  const ensure = (space = 16) => {
    if (y < margin + space) { page = pdf.addPage([W, H]); y = H - margin; }
  };

  const wrap = (text: string, f: typeof font, size: number): string[] => {
    const out: string[] = [];
    for (const raw of text.split("\n")) {
      if (raw === "") { out.push(""); continue; }
      let line = "";
      for (const word of raw.split(/\s+/)) {
        const trial = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(trial, size) > maxW && line) { out.push(line); line = word; }
        else line = trial;
      }
      if (line) out.push(line);
    }
    return out;
  };

  const draw = (text: string, opts: { f?: typeof font; size?: number; color?: typeof INK; gap?: number; x?: number } = {}) => {
    const f = opts.f ?? font, size = opts.size ?? 11, color = opts.color ?? INK, gap = opts.gap ?? 4, x = opts.x ?? margin;
    for (const line of wrap(text, f, size)) {
      if (line === "") { y -= size * 0.6; continue; }
      ensure(size + gap);
      page.drawText(line, { x, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  };

  // ── Header ──
  draw("JLS YACHTS LLC", { f: bold, size: 10, color: GOLD, gap: 2 });
  draw(def.title, { f: bold, size: 17, gap: 3 });
  if (def.intro) draw(def.intro, { size: 9, color: GREY, gap: 6 });
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 1, color: rgb(0.85, 0.88, 0.9) });
  y -= 16;

  if (def.bodyTemplate) {
    // Letter-style: merge {{field}} placeholders and render as prose.
    const merged = def.bodyTemplate.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      const v = values[k];
      return v === null || v === undefined || v === "" ? "" : String(v);
    });
    draw(merged, { size: 11, gap: 5 });
  } else {
    for (const section of def.sections) {
      if (section.title) { y -= 6; draw(section.title.toUpperCase(), { f: bold, size: 11, color: GOLD, gap: 6 }); }
      for (const field of section.fields) {
        ensure(28);
        draw(field.label, { f: bold, size: 9, color: GREY, gap: 2 });
        draw(fmtVal(values[field.key]), { size: 11, gap: 8 });
      }
    }
  }

  // ── Footer on every page ──
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(
      `Generated via Anchor · JLS Yachts · page ${i + 1} of ${pages.length}`,
      { x: margin, y: 30, size: 8, font, color: GREY },
    );
  });

  return pdf.save();
}
