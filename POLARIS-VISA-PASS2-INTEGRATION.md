# POLARIS — VISA UI MIGRATION: PASS 2 INTEGRATION GUIDE
# Ticket #196 · Migration 053
# Author: Captain Mike — JLS Yachts LLC
# Developer: Matt Tighe
#
# This file tells you exactly where to drop the four new components and how to
# wire them into the existing pages. No schema changes. No new migrations.
# Pure component swap — old out, new in.
# ─────────────────────────────────────────────────────────────────────────────


## FILES TO ADD

Copy all four files into src/components/visa/:

  VisaStatCards.tsx
  VisaCrewTable.tsx
  VesselChannelSelector.tsx
  VesselReportHistory.tsx
  index.ts  (barrel — replaces or extends existing one)


## 1. VISA STAT CARDS
## Replaces: the four metric blocks in VesselReportScreen (migration 051)
## ─────────────────────────────────────────────────────────────────────────────

### Remove

Delete the existing navy-header stat blocks. They look something like:

  <div className="stat-block navy-bg">
    <span className="stat-number">{expired}</span>
    <span className="stat-label">Expired</span>
  </div>

### Add

  import { VisaStatCards } from '@/components/visa';

  <VisaStatCards
    total={data?.total ?? null}
    active={data?.active ?? null}
    expiring={data?.expiring ?? null}
    expired={data?.expired ?? null}
    expiringUrgent={data?.expiringWithin5WorkingDays}
    onCardClick={(variant) => {
      // Scroll to the relevant VisaCrewTable section
      document.getElementById(`section-${variant}`)?.scrollIntoView({ behavior: 'smooth' });
    }}
  />

### Loading state

Pass null for any count while the query is in-flight — the component renders
skeleton loaders automatically. No separate loading state needed.


## 2. VISA CREW TABLE
## Replaces: the three dense tables (Expired / Expiring / Active) in VesselReportScreen
## ─────────────────────────────────────────────────────────────────────────────

### Remove

The three <table> blocks or DataTable components for expired, expiring, and
active crew. These typically have headers: Name / Role / Nationality / Visa /
Expiry / Status.

### Add — three instances, one per section

  import { VisaCrewTable } from '@/components/visa';

  {/* Expired */}
  <div id="section-expired">
    <VisaCrewTable
      variant="expired"
      title="Expired visas"
      records={expiredRecords}     // VisaCrewRecord[] | null
      onRowClick={(record) => router.push(`/visas/applications/${record.id}`)}
    />
  </div>

  {/* Expiring */}
  <div id="section-expiring">
    <VisaCrewTable
      variant="expiring"
      title="Expiring soon"
      records={expiringRecords}
      defaultRows={5}
      onRowClick={(record) => router.push(`/visas/applications/${record.id}`)}
    />
  </div>

  {/* Active */}
  <div id="section-active">
    <VisaCrewTable
      variant="active"
      title="Active visas"
      records={activeRecords}
      onRowClick={(record) => router.push(`/visas/applications/${record.id}`)}
      onAddVisa={() => router.push('/visas/applications/new')}
    />
  </div>

### Data shape

The component expects VisaCrewRecord[]. Map your Supabase query output like this:

  const mapToCrewRecord = (row: any): VisaCrewRecord => ({
    id:           row.id,
    crewName:     row.crew_member?.full_name ?? '—',
    role:         row.crew_member?.role ?? '—',
    nationality:  row.crew_member?.nationality ?? '—',
    passportNo:   row.passport_number ?? '—',
    visaType:     row.visa_type ?? 'UAE Visa',
    expiryDate:   row.expiry_date,
    daysUntil:    row.days_until_expiry,      // from your existing flag logic
    workingDays:  row.working_days_until,     // from working_days_until() function
    status:       row.expiry_status,          // 'active' | 'expiring_30' | 'expiring_10' | 'expiring_5' | 'expired'
    photoUrl:     row.crew_member?.photo_url,
  });

  const expiredRecords  = data?.filter(r => r.status === 'expired').map(mapToCrewRecord) ?? null;
  const expiringRecords = data?.filter(r => ['expiring_30','expiring_10','expiring_5'].includes(r.status)).map(mapToCrewRecord) ?? null;
  const activeRecords   = data?.filter(r => r.status === 'active').map(mapToCrewRecord) ?? null;


## 3. VESSEL CHANNEL SELECTOR
## Replaces: the radio button group in VesselCommsPreferences (migration 050)
## ─────────────────────────────────────────────────────────────────────────────

### Remove

The <fieldset> / <input type="radio"> group for Email / WhatsApp / Both.
Typically looks like:

  <label><input type="radio" name="channel" value="email" /> Email</label>
  <label><input type="radio" name="channel" value="whatsapp" /> WhatsApp</label>
  <label><input type="radio" name="channel" value="both" /> Both</label>

### Add

  import { VesselChannelSelector } from '@/components/visa';
  import { useState } from 'react';

  const [channel, setChannel] = useState<DeliveryChannel>(
    vessel.preferred_channel ?? 'email'
  );

  <VesselChannelSelector
    value={channel}
    onChange={setChannel}
    label="Delivery channel"
    disabled={isSaving}
  />

### Saving

The component is fully controlled — it never writes to the database itself.
Call your existing save handler (PATCH /api/vessels/:id/comms-prefs) when the
user clicks your Save button, passing the channel value from state.

### Toggle state

The component's active-state toggle (blue left border, checkmark, tinted bg)
is driven entirely by the value prop. No internal state to sync.


## 4. VESSEL REPORT HISTORY
## Replaces: VesselReportHistory.jsx and VesselReportHistoryView.jsx old versions
## ─────────────────────────────────────────────────────────────────────────────

### Remove

The old history list — likely a <ul> with timestamped <li> rows, using old
design tokens for the send-status colouring.

### Add

  import { VesselReportHistory } from '@/components/visa';

  <VesselReportHistory
    records={historyRecords}   // ReportHistoryRecord[] | null
    onViewSnapshot={(record) => {
      // Navigate to the read-only snapshot view
      // The snapshot_data field in visa_report_log is write-once — never mutate.
      router.push(`/visas/reports/${vesselId}/history/${record.id}`);
    }}
    pageSize={10}
  />

### Data shape

Map from visa_report_log:

  const mapToHistoryRecord = (row: any): ReportHistoryRecord => ({
    id:             row.id,
    generatedAt:    row.generated_at,
    sentAt:         row.sent_at ?? undefined,
    vesselName:     row.vessel?.name ?? '—',
    sentBy:         row.sent_by_user?.full_name ?? undefined,
    channel:        row.delivery_channel ?? undefined,
    recipientEmail: row.recipient_email ?? undefined,
    status:         row.send_status,         // 'sent' | 'failed' | 'pending' | 'draft'
    crewCount:      row.snapshot_data?.total_crew ?? 0,
    expiredCount:   row.snapshot_data?.expired_count ?? 0,
    expiringCount:  row.snapshot_data?.expiring_count ?? 0,
  });

  const historyRecords = historyData?.map(mapToHistoryRecord) ?? null;

### Architecture reminder

snapshot_data is WRITE-ONCE. The onViewSnapshot callback should navigate to a
read-only page that renders row.snapshot_data as a frozen report — never
re-fetch live data for a historical record.


## COMMIT MESSAGE

Once all four swaps are in and visually verified:

  git add src/components/visa/
  git commit -m "feat: visa module — Pass 2 component rebuilds (ticket #196)"

Keep this as a separate commit from Pass 1 (token swap).


## VISUAL QA CHECKLIST

After deploying to staging, walk through each item:

  [ ] Stat cards: all four render with correct left-border colour
  [ ] Stat cards: skeleton loaders appear on first load (null state)
  [ ] Stat cards: clicking a card scrolls to the correct section
  [ ] Stat cards: responsive — 2-col at 900px, 1-col at 480px
  [ ] Crew table: card rows render (not dense table)
  [ ] Crew table: status dot correct colour per status
  [ ] Crew table: "View all N records" expands correctly
  [ ] Crew table: empty state shows contextual message, not "No data"
  [ ] Crew table: row click navigates to application detail
  [ ] Channel selector: three cards render correctly
  [ ] Channel selector: selected card has blue left border + checkmark
  [ ] Channel selector: keyboard navigation works (Tab + Space/Enter)
  [ ] Channel selector: WhatsApp crew delivery shows correct info note
  [ ] Report history: rows render with date block, vessel name, status chip
  [ ] Report history: "View" button navigates to snapshot (not live data)
  [ ] Report history: pagination works at pageSize boundary
  [ ] Report history: empty state has helpful message
  [ ] All: no navy #0D1F3C or gold #C9A84C visible anywhere
  [ ] All: font stack shows Halis GR headings, DINPro body/labels
  [ ] All: dark mode renders correctly (CSS vars respond to prefers-color-scheme)

─────────────────────────────────────────────────────────────────────────────
