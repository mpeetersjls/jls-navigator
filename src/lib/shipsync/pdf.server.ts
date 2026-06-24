/**
 * ShipSync delivery-note PDF generation (server-side, pdf-lib).
 * Produces a clean A4 note: JLS header, DN number, vessel, driver, date, a table
 * of packages (line / AWB / owner / qty) and a signature block.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ShipSyncDeliveryNote, ShipSyncPackage } from './model'

const NAVY = rgb(0.05, 0.10, 0.16)
const GREY = rgb(0.45, 0.49, 0.54)
const LINE = rgb(0.85, 0.87, 0.89)

export async function buildDeliveryNotePdf(
  note: ShipSyncDeliveryNote,
  packages: ShipSyncPackage[],
  kind: 'predelivery' | 'delivery',
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, H = 841.89, M = 48
  let page = doc.addPage([W, H])
  let y = H - M

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = NAVY) =>
    page.drawText(s ?? '', { x, y: yy, size, font: f, color })

  // Header
  text('JLS YACHTS', M, y, 18, bold)
  text(kind === 'predelivery' ? 'PRE-DELIVERY NOTE' : 'DELIVERY NOTE', W - M - 170, y, 14, bold)
  y -= 16
  text('Yacht Logistics', M, y, 9, font, GREY)
  text(`DN-${note.number ?? '—'}`, W - M - 170, y, 11, bold)
  y -= 26
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE })
  y -= 22

  // Meta
  const meta: [string, string][] = [
    ['Vessel', note.boat_name ?? '—'],
    ['Date', new Date(note.delivered_at ?? note.created_at ?? Date.now()).toLocaleDateString('en-GB')],
    ['Destination', note.destination_address ?? '—'],
    ['Packages', String(packages.length)],
  ]
  for (const [k, v] of meta) {
    text(k.toUpperCase(), M, y, 8, bold, GREY)
    text(v, M + 90, y, 10)
    y -= 18
  }
  y -= 8
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE })
  y -= 20

  // Table header
  const cols = [M, M + 36, M + 220, W - M - 50]
  text('#', cols[0], y, 8, bold, GREY)
  text('AWB / REFERENCE', cols[1], y, 8, bold, GREY)
  text('OWNER', cols[2], y, 8, bold, GREY)
  text('QTY', cols[3], y, 8, bold, GREY)
  y -= 6
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE })
  y -= 16

  packages.forEach((p, i) => {
    if (y < M + 120) { page = doc.addPage([W, H]); y = H - M }
    text(String(i + 1), cols[0], y, 10)
    text((p.barcode ?? '—').slice(0, 30), cols[1], y, 10)
    text((p.package_owner ?? '—').slice(0, 26), cols[2], y, 10)
    text(String(p.num_packages ?? 1), cols[3], y, 10)
    y -= 18
  })

  // Signature block
  y = Math.max(y - 30, M + 70)
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE })
  y -= 24
  text('Received by:', M, y, 9, bold, GREY)
  text('Signature:', W / 2, y, 9, bold, GREY)
  y -= 40
  page.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.5, color: LINE })
  page.drawLine({ start: { x: W / 2, y }, end: { x: W / 2 + 200, y }, thickness: 0.5, color: LINE })
  y -= 14
  text('Name / Designation / Date', M, y, 8, font, GREY)

  return doc.save()
}
