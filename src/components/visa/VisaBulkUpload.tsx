import { useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { fileToBase64 } from '@/lib/file-to-base64'
import { COLORS, FONTS } from '@/lib/tokens'
import { toast } from 'sonner'

/**
 * Bulk visa intake: drop/select many visa files, OCR each, confidence-match it to
 * an existing crew member (passport number = high, name = medium). Matched rows can
 * be filed against that crew; unmatched rows pre-fill a new crew draft to create.
 */

type CrewHit = { id: string; name: string; passport_number: string | null }

type Row = {
  key: string
  fileName: string
  base64: string
  contentType: string
  status: 'scanning' | 'ready' | 'working' | 'done' | 'error'
  error?: string
  ocr?: any
  match?: CrewHit | null
  confidence?: 'high' | 'medium' | 'none'
  resultLabel?: string
}

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function VisaBulkUpload({ countryCode, onClose, onChanged }: {
  countryCode?: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const db = supabase as any

  async function matchCrew(ocr: any): Promise<{ hit: CrewHit | null; confidence: 'high' | 'medium' | 'none' }> {
    const pn = norm(ocr?.passport_number)
    // 1) Exact passport-number match (high confidence) — via passports then crew.
    if (pn) {
      const { data: cm } = await db.from('crew_members').select('id, first_name, last_name, passport_number')
      const exact = (cm ?? []).find((c: any) => norm(c.passport_number) === pn)
      if (exact) return { hit: { id: exact.id, name: `${exact.first_name ?? ''} ${exact.last_name ?? ''}`.trim(), passport_number: exact.passport_number }, confidence: 'high' }
      const { data: cp } = await db.from('crew_passports').select('crew_id, passport_number')
      const pHit = (cp ?? []).find((p: any) => norm(p.passport_number) === pn)
      if (pHit?.crew_id) {
        const { data: c } = await db.from('crew_members').select('id, first_name, last_name, passport_number').eq('id', pHit.crew_id).maybeSingle()
        if (c) return { hit: { id: c.id, name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(), passport_number: c.passport_number }, confidence: 'high' }
      }
    }
    // 2) Name match (medium confidence).
    const sn = norm(ocr?.surname), gn = norm(ocr?.given_names)
    if (sn || gn) {
      const { data: cm } = await db.from('crew_members').select('id, first_name, last_name, passport_number')
      const nHit = (cm ?? []).find((c: any) => norm(c.last_name) === sn && (gn ? norm(c.first_name).includes(gn.slice(0, 4)) : true))
      if (nHit) return { hit: { id: nHit.id, name: `${nHit.first_name ?? ''} ${nHit.last_name ?? ''}`.trim(), passport_number: nHit.passport_number }, confidence: 'medium' }
    }
    return { hit: null, confidence: 'none' }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${rows.length}-${Math.round(performance.now())}`
      let base64 = ''
      try { base64 = await fileToBase64(file) } catch { /* skip */ }
      setRows(prev => [...prev, { key, fileName: file.name, base64, contentType: file.type, status: 'scanning' }])
      try {
        const r = await fetch('/api/visa/passport-ocr', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType: file.type, docType: 'visa' }),
        })
        const j = await r.json()
        if (!j.ok) { setRows(prev => prev.map(x => x.key === key ? { ...x, status: 'error', error: j.error ?? 'Scan failed' } : x)); continue }
        const { hit, confidence } = await matchCrew(j.data)
        setRows(prev => prev.map(x => x.key === key ? { ...x, status: 'ready', ocr: j.data, match: hit, confidence } : x))
      } catch (e) {
        setRows(prev => prev.map(x => x.key === key ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'Scan error' } : x))
      }
    }
  }

  // Upload the file + create an approved visa application for a crew member.
  async function fileVisaFor(row: Row, crewId: string) {
    const ext = row.fileName.split('.').pop() || 'pdf'
    const path = `visa/bulk/${crewId}-${Date.now()}.${ext}`
    const bytes = Uint8Array.from(atob(row.base64), c => c.charCodeAt(0))
    await supabase.storage.from('permit-documents').upload(path, bytes, { contentType: row.contentType || 'application/octet-stream', upsert: true })
    const url = supabase.storage.from('permit-documents').getPublicUrl(path).data.publicUrl
    const o = row.ocr ?? {}
    await db.from('visa_applications').insert({
      crew_member_id: crewId, status: 'approved', visa_type: o.visa_type ?? 'Crew Visa',
      country_code: countryCode ?? null, destination_country: o.destination_country ?? null,
      visa_number: o.visa_number ?? null, visa_issuance_date: o.issue_date ?? null,
      visa_expiry: o.expiry_date ?? null, first_entry_expiry: o.first_entry_expiry ?? null,
      passport_number: o.passport_number ?? null, nationality: o.nationality ?? null,
      given_name: o.given_names ?? null, surname: o.surname ?? null,
      visa_document_url: url, approved_at: new Date().toISOString(),
    })
  }

  async function handleMatch(row: Row) {
    if (!row.match) return
    setRows(prev => prev.map(x => x.key === row.key ? { ...x, status: 'working' } : x))
    try {
      await fileVisaFor(row, row.match.id)
      setRows(prev => prev.map(x => x.key === row.key ? { ...x, status: 'done', resultLabel: `Filed to ${row.match!.name}` } : x))
      onChanged()
    } catch (e) {
      setRows(prev => prev.map(x => x.key === row.key ? { ...x, status: 'ready', error: e instanceof Error ? e.message : 'Failed' } : x))
      toast.error('Could not file the visa')
    }
  }

  async function handleCreate(row: Row) {
    const o = row.ocr ?? {}
    setRows(prev => prev.map(x => x.key === row.key ? { ...x, status: 'working' } : x))
    try {
      const { data: crew, error } = await db.from('crew_members').insert({
        first_name: (o.given_names ?? o.holder_name ?? 'New').trim() || 'New',
        last_name: (o.surname ?? '').trim() || 'Crew',
        nationality: o.nationality ?? null,
        date_of_birth: o.date_of_birth ?? null,
        passport_number: o.passport_number ?? null,
        status: 'active',
      }).select('id, first_name, last_name').single()
      if (error) throw error
      await fileVisaFor(row, crew.id)
      setRows(prev => prev.map(x => x.key === row.key ? { ...x, status: 'done', resultLabel: `Created ${crew.first_name} ${crew.last_name} + filed visa` } : x))
      onChanged()
    } catch (e) {
      setRows(prev => prev.map(x => x.key === row.key ? { ...x, status: 'ready', error: e instanceof Error ? e.message : 'Failed' } : x))
      toast.error('Could not create the crew member')
    }
  }

  const confColor = (c?: string) => c === 'high' ? '#22c55e' : c === 'medium' ? COLORS.leoAmber : COLORS.steel

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(820px, 100%)', background: COLORS.abyss, border: `1px solid ${COLORS.deep}`, borderRadius: 12, padding: 22, fontFamily: FONTS.display, color: COLORS.frost }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Bulk Upload Visas</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 0 }}>
          Drop multiple visas — each is scanned and matched to a crew member. File a match, or create a new crew member from the scan.
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '26px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: `2px dashed ${dragOver ? COLORS.signal : COLORS.deep}`, background: dragOver ? `${COLORS.signal}0c` : COLORS.void }}
        >
          <div style={{ fontSize: 26, color: COLORS.signal }}>↑</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.signal }}>Drag &amp; drop visas here, or click</div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>PDF, JPG or PNG · multiple files supported</div>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: 'none' }} onChange={e => { void addFiles(e.target.files); if (e.target) e.target.value = '' }} />
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(row => (
              <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: COLORS.void, border: `1px solid ${COLORS.deep}`, borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.fileName}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>
                    {row.status === 'scanning' ? 'Scanning…'
                      : row.status === 'error' ? <span style={{ color: COLORS.warn }}>{row.error}</span>
                      : row.status === 'done' ? <span style={{ color: '#22c55e' }}>✓ {row.resultLabel}</span>
                      : <>
                          {row.ocr?.holder_name || [row.ocr?.given_names, row.ocr?.surname].filter(Boolean).join(' ') || '—'}
                          {row.ocr?.passport_number ? ` · ${row.ocr.passport_number}` : ''}
                          {' · '}
                          <span style={{ color: confColor(row.confidence) }}>
                            {row.confidence === 'high' ? `Match: ${row.match?.name} (passport)` : row.confidence === 'medium' ? `Likely: ${row.match?.name} (name)` : 'No match found'}
                          </span>
                        </>}
                  </div>
                </div>
                {(row.status === 'ready') && (
                  row.match
                    ? <button onClick={() => handleMatch(row)} style={btn(COLORS.signal, COLORS.void)}>Match</button>
                    : <button onClick={() => handleCreate(row)} style={btn('transparent', COLORS.signal, COLORS.signal)}>Create crew</button>
                )}
                {row.status === 'working' && <span style={{ fontSize: 11, color: COLORS.muted }}>Working…</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function btn(bg: string, color: string, border?: string): React.CSSProperties {
  return { fontFamily: FONTS.display, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: bg, color, border: border ? `1px solid ${border}` : 'none', flexShrink: 0 }
}
