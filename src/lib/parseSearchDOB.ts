/**
 * Parses a date string in any accepted format into ISO YYYY-MM-DD.
 * Returns null if parsing fails — a null DOB is valid (search by name only).
 * POLARIS-SEARCH-006
 */
export function parseSearchDOB(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return null

  const str = input.trim()

  // DD/MM/YYYY  (Polaris standard — always try first)
  const dmySlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmySlash) {
    const [, d, m, y] = dmySlash
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // YYYY-MM-DD  (ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // DD-MM-YYYY
  const dmyDash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmyDash) {
    const [, d, m, y] = dmyDash
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD MMM YYYY  (e.g. "11 May 1974")
  const dMonthY = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (dMonthY) {
    const MONTHS: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const [, d, mon, y] = dMonthY
    const m = MONTHS[mon.toLowerCase().slice(0, 3)]
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`
  }

  return null
}
