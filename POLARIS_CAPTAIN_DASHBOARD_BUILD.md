# POLARIS_CAPTAIN_DASHBOARD_BUILD.md
# Claude Code — Step-by-step build instructions for the Captain Dashboard
# Read CLAUDE.md first, then POLARIS_CAPTAIN_DASHBOARD.md, then follow this file.
#
# This file is written for Claude Code.
# Every instruction is an explicit action. No ambiguity. No assumptions.
#
# Author: Mike Fetton — JLS Yachts LLC
# Version: 1.0 — June 2026
# Tickets: #146–#165
---
## READ FIRST — BEFORE TOUCHING ANY CODE
1. Read `CLAUDE.md` (v1.5) completely before writing a single line.
2. Read `POLARIS_CAPTAIN_DASHBOARD.md` completely.
3. Read `POLARIS_ACCESS_CONTROL.md` — the `requireAccess()` middleware
   and `logAuditEvent()` helpers must already exist before this build starts.
4. Read `POLARIS_VISA_MODULE.md` — the visa tables and API routes already
   exist and must not be duplicated.
5. Confirm migrations 001–014 have been run. If not, stop and run them first.
---
## PHASE 1 — DATABASE (Ticket #154)
Run these migrations IN ORDER in the Supabase SQL editor.
Do not skip. Do not reorder.
### Migration 015 — operations_requests
```sql
CREATE TABLE IF NOT EXISTS operations_requests (
  request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id     UUID NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
  submitted_by  UUID NOT NULL REFERENCES auth.users(id),
  category      TEXT NOT NULL CHECK (category IN (
                  'immigration','bunkering','berthing','visa',
                  'technical','logistics','provisioning','crew_care'
                )),
  description   TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'routine'
                  CHECK (priority IN ('routine','urgent','emergency')),
  required_date DATE,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN (
                    'open','in_progress','pending_captain','complete','cancelled'
                  )),
  assigned_to   UUID REFERENCES auth.users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  closed_at     TIMESTAMPTZ
);
ALTER TABLE operations_requests ENABLE ROW LEVEL SECURITY;
-- Captain can see own vessel requests only
CREATE POLICY "captain_vessel_requests" ON operations_requests
  FOR SELECT USING (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
  );
-- Captain can create requests for own vessel
CREATE POLICY "captain_create_request" ON operations_requests
  FOR INSERT WITH CHECK (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
    AND submitted_by = auth.uid()
  );
-- Captain can add notes to own requests (no status change)
CREATE POLICY "captain_note_request" ON operations_requests
  FOR UPDATE USING (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
    AND submitted_by = auth.uid()
  ) WITH CHECK (
    -- Captain can only update the notes field
    status = (SELECT status FROM operations_requests WHERE request_id = operations_requests.request_id)
  );
-- JLS staff can see and update all
CREATE POLICY "jls_all_requests" ON operations_requests
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('global_admin','jls_staff')
  );
CREATE INDEX idx_ops_requests_vessel ON operations_requests(vessel_id);
CREATE INDEX idx_ops_requests_status ON operations_requests(status);
```
### Migration 016 — bunkering_requests
```sql
CREATE TABLE IF NOT EXISTS bunkering_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id       UUID NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
  submitted_by    UUID NOT NULL REFERENCES auth.users(id),
  fuel_type       TEXT NOT NULL CHECK (fuel_type IN ('MGO','VLSFO','MDO','IFO')),
  quantity_mt     NUMERIC(10,2) NOT NULL,
  location        TEXT NOT NULL,
  required_date   DATE NOT NULL,
  instructions    TEXT,
  status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN (
                      'requested','quoted','quote_accepted',
                      'delivery_scheduled','delivered','invoiced'
                    )),
  accepted_quote_id UUID,
  supplier_name   TEXT,
  delivery_confirmed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bunkering_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captain_own_vessel_bunkering" ON bunkering_requests
  FOR ALL USING (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
  );
CREATE POLICY "jls_all_bunkering" ON bunkering_requests
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('global_admin','jls_staff')
  );
CREATE INDEX idx_bunkering_vessel ON bunkering_requests(vessel_id);
```
### Migration 017 — berthing_requests
```sql
CREATE TABLE IF NOT EXISTS berthing_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id       UUID NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
  submitted_by    UUID NOT NULL REFERENCES auth.users(id),
  type            TEXT NOT NULL CHECK (type IN (
                    'new_berth','relocation','extension','departure'
                  )),
  marina          TEXT,
  preferred_berth TEXT,
  arrival_date    DATE,
  departure_date  DATE,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN (
                      'requested','confirmed','amended','cancelled'
                    )),
  confirmed_berth TEXT,
  confirmed_by    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE berthing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captain_own_vessel_berthing" ON berthing_requests
  FOR ALL USING (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
  );
CREATE POLICY "jls_all_berthing" ON berthing_requests
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('global_admin','jls_staff')
  );
```
### Migration 018 — crew_care_requests
```sql
CREATE TABLE IF NOT EXISTS crew_care_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id     UUID NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
  crew_id       UUID REFERENCES crew_members(crew_id),
  submitted_by  UUID NOT NULL REFERENCES auth.users(id),
  category      TEXT NOT NULL CHECK (category IN (
                  'airport_transfer','hotel_transfer','marina_transfer',
                  'doctor','hospital','sim_card','local_info'
                )),
  details       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN (
                    'requested','assigned','in_progress','complete','cancelled'
                  )),
  assigned_to   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crew_care_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captain_own_vessel_crew_care" ON crew_care_requests
  FOR ALL USING (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
  );
CREATE POLICY "jls_all_crew_care" ON crew_care_requests
  FOR ALL USING (
    (auth.jwt() ->> 'role') IN ('global_admin','jls_staff')
  );
```
### Migration 019 — incident_reports
```sql
CREATE TABLE IF NOT EXISTS incident_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id     UUID NOT NULL REFERENCES vessels(vessel_id) ON DELETE CASCADE,
  reported_by   UUID NOT NULL REFERENCES auth.users(id),
  type          TEXT NOT NULL CHECK (type IN (
                  'security','accident','crew_injury','pollution','other'
                )),
  description   TEXT NOT NULL,
  location      TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL,
  injuries      BOOLEAN NOT NULL DEFAULT false,
  persons_involved TEXT,
  immediate_action TEXT,
  jls_notified  BOOLEAN NOT NULL DEFAULT false,
  reported_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
-- Captain can create and view own vessel incidents
CREATE POLICY "captain_incidents" ON incident_reports
  FOR ALL USING (
    vessel_id = ANY((auth.jwt() ->> 'vessel_ids')::uuid[])
  );
-- No update/delete for anyone except global admin
CREATE POLICY "incident_no_edit" ON incident_reports
  FOR UPDATE USING (
    (auth.jwt() ->> 'role') = 'global_admin'
  );
CREATE POLICY "jls_view_incidents" ON incident_reports
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('global_admin','jls_staff')
  );
```
---
## PHASE 2 — API ROUTES (Ticket #155)
Create these files. Every route starts with requireAccess(). Every
mutation ends with logAuditEvent(). No exceptions.
### File: `app/api/captain/[vesselId]/dashboard/route.ts`
```typescript
import { requireAccess } from '@/lib/auth/access';
import { logAuditEvent } from '@/lib/auth/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
export async function GET(
  request: Request,
  { params }: { params: { vesselId: string } }
) {
  const session = await requireAccess(request, ['captain','vessel_admin','senior_crew']);
  if (!session.ok) return session.response;
  // Vessel scope check — captain can only see own vessel
  if (!session.user.vessel_ids?.includes(params.vesselId)) {
    return Response.json({ error: 'Vessel not in scope' }, { status: 403 });
  }
  const vesselId = params.vesselId;
  // Parallel fetch — never sequential awaits
  const [
    vesselRes,
    crewRes,
    alertsRes,
    visaAppsRes,
    shipmentsRes,
    requestsRes,
    berthRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('vessels')
      .select('*')
      .eq('vessel_id', vesselId)
      .single(),
    supabaseAdmin
      .from('crew_members')
      .select('crew_id,full_name,rank,nationality,signed_on,visa_expiry,passport_expiry,seamans_book_expiry')
      .eq('vessel_id', vesselId)
      .order('rank'),
    supabaseAdmin
      .from('compliance_alerts')
      .select('*')
      .eq('vessel_id', vesselId)
      .eq('resolved', false)
      .order('severity', { ascending: false }),
    supabaseAdmin
      .from('visa_applications')
      .select('application_id,crew_id,type,status,created_at,crew_members(full_name)')
      .eq('vessel_id', vesselId)
      .not('status', 'in', '(complete,declined)')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('shipsync_shipments')
      .select('*')
      .eq('vessel_id', vesselId)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('operations_requests')
      .select('*')
      .eq('vessel_id', vesselId)
      .neq('status', 'complete')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('berthing_requests')
      .select('confirmed_berth,arrival_date,departure_date,status')
      .eq('vessel_id', vesselId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return Response.json({
    vessel:    vesselRes.data,
    crew:      crewRes.data ?? [],
    alerts:    alertsRes.data ?? [],
    visaApps:  visaAppsRes.data ?? [],
    shipments: shipmentsRes.data ?? [],
    requests:  requestsRes.data ?? [],
    berth:     berthRes.data ?? null,
  });
}
```
### File: `app/api/captain/[vesselId]/requests/route.ts`
```typescript
import { requireAccess } from '@/lib/auth/access';
import { logAuditEvent } from '@/lib/auth/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
export async function GET(
  request: Request,
  { params }: { params: { vesselId: string } }
) {
  const session = await requireAccess(request, ['captain','vessel_admin','senior_crew']);
  if (!session.ok) return session.response;
  if (!session.user.vessel_ids?.includes(params.vesselId)) {
    return Response.json({ error: 'Vessel not in scope' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? '';
  let query = supabaseAdmin
    .from('operations_requests')
    .select('*')
    .eq('vessel_id', params.vesselId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ requests: data });
}
export async function POST(
  request: Request,
  { params }: { params: { vesselId: string } }
) {
  const session = await requireAccess(request, ['captain','vessel_admin']);
  if (!session.ok) return session.response;
  if (!session.user.vessel_ids?.includes(params.vesselId)) {
    return Response.json({ error: 'Vessel not in scope' }, { status: 403 });
  }
  const body = await request.json();
  const { category, description, priority, required_date } = body;
  if (!category || !description) {
    return Response.json({ error: 'category and description required' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('operations_requests')
    .insert({
      vessel_id:     params.vesselId,
      submitted_by:  session.user.id,
      category,
      description,
      priority:      priority ?? 'routine',
      required_date: required_date ?? null,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await logAuditEvent({
    event_type:   'DATA',
    actor_id:     session.user.id,
    actor_email:  session.user.email,
    actor_role:   session.user.role,
    target_type:  'operations_request',
    target_id:    data.request_id,
    target_label: `${category} request — vessel ${params.vesselId}`,
    detail:       `Support request submitted: ${category} — ${priority ?? 'routine'}`,
    ip_address:   request.headers.get('x-forwarded-for'),
    result:       'success',
  });
  return Response.json({ request: data }, { status: 201 });
}
```
### File: `app/api/captain/[vesselId]/bunkering/route.ts`
```typescript
// Pattern: same requireAccess + vessel scope check + logAuditEvent as above.
// GET: return bunkering_requests for vessel, ordered by created_at desc.
// POST: insert new bunkering_request.
//       Required fields: fuel_type, quantity_mt, location, required_date.
//       logAuditEvent event_type: 'DATA', detail: 'Bunkering request submitted'.
// No PUT/DELETE routes for captain role.
```
### File: `app/api/captain/[vesselId]/berthing/route.ts`
```typescript
// Pattern: same as bunkering route above.
// GET: return berthing_requests for vessel.
// POST: insert new berthing_request.
//       Required fields: type, arrival_date.
//       logAuditEvent event_type: 'DATA', detail: 'Berthing request submitted'.
```
### File: `app/api/captain/[vesselId]/crew-care/route.ts`
```typescript
// Pattern: same as above.
// GET: return crew_care_requests for vessel, with crew_members join for name.
// POST: insert new crew_care_request.
//       Required fields: category, details (JSONB).
//       details shape varies by category — validate client-side, store as-is.
//       logAuditEvent event_type: 'DATA', detail: 'Crew care request: {category}'.
```
### File: `app/api/captain/[vesselId]/incidents/route.ts`
```typescript
// GET: return incident_reports for vessel.
// POST: insert new incident_report.
//       Required fields: type, description, occurred_at.
//       After insert: set jls_notified = true and send notification to
//         JLS duty manager (email via Supabase edge function or similar).
//       logAuditEvent event_type: 'SEC', detail: 'Incident report: {type}'.
// NO UPDATE or DELETE routes — incidents are permanent.
```
---
## PHASE 3 — SHARED UTILITY (Ticket #146)
### File: `lib/captain/getDashboardAlerts.ts`
```typescript
// Generates the sorted alerts list from raw dashboard data.
// Used by AlertsPanel. Sorting: red first, amber second, grey last.
import { addDays, isAfter, isBefore } from 'date-fns';
export type AlertSeverity = 'red' | 'amber' | 'grey';
export type DashboardAlert = {
  id:       string;
  type:     string;
  label:    string;
  detail:   string;
  severity: AlertSeverity;
  href:     string;   // where to go when clicked
};
export function getDashboardAlerts({
  crew,
  shipments,
  requests,
  berth,
}: {
  crew: any[];
  shipments: any[];
  requests: any[];
  berth: any | null;
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const now = new Date();
  // Visa expiry within 30 days → red
  crew.forEach(c => {
    if (c.visa_expiry) {
      const exp = new Date(c.visa_expiry);
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      if (daysLeft <= 30 && daysLeft > 0) {
        alerts.push({
          id:       `visa-${c.crew_id}`,
          type:     'visa_expiry',
          label:    `${c.full_name} — Crew Visa`,
          detail:   `Expires ${exp.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}`,
          severity: 'red',
          href:     '/crew',
        });
      }
    }
  });
  // Passport expiry within 60 days → red
  crew.forEach(c => {
    if (c.passport_expiry) {
      const exp = new Date(c.passport_expiry);
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      if (daysLeft <= 60 && daysLeft > 0) {
        alerts.push({
          id:       `passport-${c.crew_id}`,
          type:     'passport_expiry',
          label:    `${c.full_name} — Passport`,
          detail:   `Expires ${exp.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}`,
          severity: 'red',
          href:     '/crew',
        });
      }
    }
  });
  // Customs hold → amber
  shipments
    .filter(s => s.status === 'customs_hold')
    .forEach(s => {
      alerts.push({
        id:       `customs-${s.id}`,
        type:     'customs_hold',
        label:    `${s.tracking_number} — Customs hold`,
        detail:   s.description ?? 'Shipment held at customs',
        severity: 'amber',
        href:     '/shipsync',
      });
    });
  // Berth contract within 30 days → amber
  if (berth?.departure_date) {
    const dep = new Date(berth.departure_date);
    const daysLeft = Math.ceil((dep.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 30 && daysLeft > 0) {
      alerts.push({
        id:       'berth-renewal',
        type:     'berth_renewal',
        label:    `Berth contract — ${berth.confirmed_berth ?? 'Current berth'}`,
        detail:   `Renews ${dep.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}`,
        severity: 'amber',
        href:     '/berthing',
      });
    }
  }
  // Incoming shipments ETA within 48h → grey informational
  shipments
    .filter(s => s.status === 'in_transit' && s.eta)
    .forEach(s => {
      const eta = new Date(s.eta);
      const hoursLeft = (eta.getTime() - now.getTime()) / 3600000;
      if (hoursLeft <= 48) {
        alerts.push({
          id:       `inbound-${s.id}`,
          type:     'incoming_shipment',
          label:    `${s.tracking_number} — Arriving soon`,
          detail:   `ETA ${eta.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}`,
          severity: 'grey',
          href:     '/shipsync',
        });
      }
    });
  // Pending captain actions (requests needing captain response) → amber
  requests
    .filter(r => r.status === 'pending_captain')
    .forEach(r => {
      alerts.push({
        id:       `pending-${r.request_id}`,
        type:     'pending_approval',
        label:    `${r.category} request — JLS needs response`,
        detail:   r.description?.slice(0, 60) ?? '',
        severity: 'amber',
        href:     '/requests',
      });
    });
  // Sort: red → amber → grey
  const order = { red: 0, amber: 1, grey: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
```
---
## PHASE 4 — COMPONENTS (Tickets #147–#153)
Create all files in `components/captain/`.
### File: `components/captain/VesselBanner.tsx`
```tsx
'use client';
// Full-width dark strip. Vessel identity + operational status pills.
// Props: vessel (from DB), berth (latest confirmed berthing_request | null)
// Left: anchor icon + vessel name bold + "82m · UAE Flag · Built 2019" muted
// Right: pills —
//   berth name (cyan) | ETD (amber, if set) | shore_power (green/red) |
//   "Last: X → Next: Y" (muted, if set)
// Colours from lib/tokens.ts only. No hardcoded hex.
// Empty states: if no berth confirmed, show "Location unknown" pill in muted.
// If ETD not set, do not render the ETD pill.
```
### File: `components/captain/AlertsPanel.tsx`
```tsx
'use client';
// Props: alerts: DashboardAlert[] (from getDashboardAlerts)
// Card header: warning-circle icon + "Alerts requiring action" + red count badge
// Each row:
//   <dot colour={alert.severity}> + name + <badge text={alert.detail}>
//   Clicking navigates to alert.href
// Severity dot colours:
//   red   → #E8274B
//   amber → #E8A020
//   grey  → rgba(255,255,255,0.2)
// Badge colours:
//   red   → background rgba(232,39,75,0.15)  text #E8274B
//   amber → background rgba(232,160,32,0.15) text #E8A020
//   grey  → background rgba(255,255,255,0.06) text rgba(255,255,255,0.4)
// Empty state: green check icon + "No alerts today" in green
```
### File: `components/captain/CrewManifestPanel.tsx`
```tsx
'use client';
// Props: crew[], vesselId, canEdit (boolean — false for senior_crew role)
// Each row:
//   status dot + full_name + rank + nationality + visa badge + passport badge
// Status dot: green=signed on, grey=signed off, red=any document issue
// Document badges:
//   visa_expiry < 30 days   → red "Visa Xd"
//   passport_expiry < 60d   → red "Passport Xd"
//   All OK                  → green "All clear"
// "Add Crew" button: only renders if canEdit === true
// No delete button. Not disabled — simply not rendered.
```
### File: `components/captain/VisaCentrePanel.tsx`
```tsx
'use client';
// Props: applications[], vesselId
// Each row:
//   dot + crew name (100px fixed) + visa type (60px fixed) + pipeline
// Pipeline — inline 5-step:
//   Requested → Submitted → Gov. Processing → Approved → Complete
//   Active step: cyan bg text-void
//   Complete step: green bg text-void
//   Future step: bg rgba(255,255,255,0.05) text rgba(255,255,255,0.25)
//   Arrows between steps: "›" in rgba(255,255,255,0.15)
// Status mapping:
//   requested       → step 1 active
//   submitted       → step 2 active
//   gov_processing  → step 3 active
//   approved        → step 4 active
//   complete        → step 5 active (all green)
//   declined        → step 2 red — show "Declined" badge instead of pipeline
```
### File: `components/captain/ShipSyncPanel.tsx`
```tsx
'use client';
// Props: shipments[]
// Each row:
//   tracking_number (monospace cyan 72px) +
//   description + supplier +
//   5-dot progress bar +
//   status badge
// Progress dots:
//   Filled green = complete stage
//   Filled cyan  = current stage
//   Filled red   = customs_hold (step 3 shown as red lock icon)
//   Empty circle = future stage
//   Line between dots: green if stage complete, rgba(255,255,255,0.1) otherwise
// Stage mapping:
//   order_placed   → dot 1
//   dispatched     → dot 2
//   in_transit     → dot 3
//   customs        → dot 3 (cyan — processing)
//   customs_hold   → dot 3 (red — HOLD)
//   customs_cleared→ dot 4
//   delivered      → dot 5 (all green)
// Status badge:
//   customs_hold  → red "Customs hold"
//   in_transit    → cyan "ETA {date}"
//   delivered     → green "Delivered"
//   dispatched    → muted "In transit"
```
### File: `components/captain/RequestSupportButton.tsx`
### File: `components/captain/RequestSupportModal.tsx`
```tsx
// Button: full-width cyan-tinted. Plus icon. "Request support from JLS".
// Sub-label lists all 8 categories in one line.
// onClick: open RequestSupportModal
// Modal (not position:fixed — use faux-viewport wrapper, min-height 600px):
// Step 1: 8 category tiles in a 4x2 grid. Each: icon + label. Click to select.
// Step 2: form fields:
//   - description (textarea, required)
//   - priority (select: routine / urgent / emergency)
//   - required_date (date input, optional)
//   - attachment (file input, optional)
// Step 3: confirmation card + Submit button
//
// On submit: POST to /api/captain/[vesselId]/requests
// On success: close modal, show toast "Request submitted to JLS"
// On error: show inline error, do not close modal
// Category tiles:
//   Immigration  ti-id-badge
//   Bunkering    ti-droplet
//   Berthing     ti-building-lighthouse
//   Visa         ti-file-certificate
//   Technical    ti-tool
//   Logistics    ti-truck-delivery
//   Provisioning ti-package
//   Crew Care    ti-heart-rate-monitor (amber accent, not cyan)
```
### File: `components/captain/ModuleGrid.tsx`
```tsx
'use client';
// Props: vesselId, alerts (for badge counts)
// 8 tiles in a 4x2 grid (repeat(4, minmax(0,1fr)) gap 8px)
// Each tile:
//   icon (20px, cyan) + label (10px) + optional badge below label
// Badges:
//   Visa Centre  → count of active_applications
//   ShipSync     → count of customs_hold shipments (amber "X held")
//   Emergency    → always "Always on" red badge
// Hover: border-color changes to rgba(0,196,204,0.25), bg lightens slightly
// Click: navigate to /dashboard/vessel/[vesselId]/{module}
```
---
## PHASE 5 — PAGE ASSEMBLY (Ticket #146)
### File: `app/dashboard/vessel/[vesselId]/captain/page.tsx`
```tsx
import { requireAccess }        from '@/lib/auth/access';
import { getDashboardAlerts }    from '@/lib/captain/getDashboardAlerts';
import { PolarisShell }          from '@/components/ui/PolarisShell';
import { VesselBanner }          from '@/components/captain/VesselBanner';
import { LeoBriefingPanel }      from '@/components/captain/LeoBriefingPanel';
import { DashboardMetrics }      from '@/components/captain/DashboardMetrics';
import { AlertsPanel }           from '@/components/captain/AlertsPanel';
import { CrewManifestPanel }     from '@/components/captain/CrewManifestPanel';
import { VisaCentrePanel }       from '@/components/captain/VisaCentrePanel';
import { ShipSyncPanel }         from '@/components/captain/ShipSyncPanel';
import { RequestSupportButton }  from '@/components/captain/RequestSupportButton';
import { ModuleGrid }            from '@/components/captain/ModuleGrid';
import { redirect }              from 'next/navigation';
import { supabaseAdmin }         from '@/lib/supabase/admin';
export default async function CaptainDashboard({
  params,
}: {
  params: { vesselId: string };
}) {
  // 1. Auth check
  const session = await requireAccess(null, ['captain','vessel_admin','senior_crew']);
  if (!session.ok) redirect('/auth/login?reason=unauthorized');
  // 2. Vessel scope check
  if (!session.user.vessel_ids?.includes(params.vesselId)) {
    redirect('/dashboard');
  }
  // 3. Parallel data fetch (see /api/captain/[vesselId]/dashboard for full version)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/captain/${params.vesselId}/dashboard`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );
  const { vessel, crew, alerts: rawAlerts, visaApps, shipments, requests, berth } =
    await res.json();
  // 4. Compute sorted alerts
  const alerts = getDashboardAlerts({ crew, shipments, requests, berth });
  // 5. Permission flags
  const canEdit = ['captain','vessel_admin'].includes(session.user.role);
  return (
    <PolarisShell role="captain" vesselId={params.vesselId}>
      <VesselBanner vessel={vessel} berth={berth} />
      <div className="p-4 space-y-3">
        <LeoBriefingPanel
          vesselId={params.vesselId}
          userId={session.user.id}
          briefingContext={{
            vesselName:     vessel?.name,
            location:       vessel?.current_location,
            crewCount:      crew?.filter((c: any) => c.signed_on).length,
            alertCount:     alerts.length,
            topAlert:       alerts[0] ?? null,
            customsHolds:   shipments?.filter((s: any) => s.status === 'customs_hold').length,
          }}
        />
        <DashboardMetrics
          crew={crew}
          alerts={alerts}
          shipments={shipments}
          requests={requests}
        />
        <div className="grid grid-cols-2 gap-3">
          <AlertsPanel alerts={alerts} />
          <CrewManifestPanel crew={crew} vesselId={params.vesselId} canEdit={canEdit} />
        </div>
        <VisaCentrePanel applications={visaApps} vesselId={params.vesselId} />
        <ShipSyncPanel shipments={shipments} vesselId={params.vesselId} />
        <RequestSupportButton vesselId={params.vesselId} />
        <ModuleGrid vesselId={params.vesselId} alerts={alerts} />
      </div>
    </PolarisShell>
  );
}
```
---
## PHASE 6 — SUB-PAGES
Create each as a standalone page. All share the same auth guard pattern.
Full specs in `POLARIS_CAPTAIN_DASHBOARD.md` Section 5.
Files to create:
```
app/dashboard/vessel/[vesselId]/documents/page.tsx      (Ticket #156)
app/dashboard/vessel/[vesselId]/crew/page.tsx           (Ticket #157)
app/dashboard/vessel/[vesselId]/visa/page.tsx           (Ticket #158)
app/dashboard/vessel/[vesselId]/bunkering/page.tsx      (Ticket #159)
app/dashboard/vessel/[vesselId]/berthing/page.tsx       (Ticket #160)
app/dashboard/vessel/[vesselId]/crew-care/page.tsx      (Ticket #161)
app/dashboard/vessel/[vesselId]/financials/page.tsx     (Ticket #162)
app/dashboard/vessel/[vesselId]/emergency/page.tsx      (Ticket #163)
app/dashboard/vessel/[vesselId]/uae-intel/page.tsx      (Ticket #164)
app/dashboard/vessel/[vesselId]/requests/page.tsx       (Ticket #152)
app/dashboard/vessel/[vesselId]/shipsync/page.tsx       (Ticket #151)
```
Each page skeleton:
```tsx
// Standard auth + scope guard — copy from captain/page.tsx lines 1–12.
// Then render the relevant full-page component from components/captain/{module}/.
// See POLARIS_CAPTAIN_DASHBOARD.md Section 5 for detailed spec of each page.
```
---
## PHASE 7 — LEO SYSTEM PROMPT EXTENSION (Ticket #165)
In `lib/leo/buildSystemPrompt.ts`, add this block when role is captain:
```typescript
if (role === 'captain' || role === 'vessel_admin') {
  return `
ROLE CONTEXT: You are briefing a yacht captain.
VESSEL: ${context.vesselName ?? 'Unknown vessel'} — currently at ${context.location ?? 'location unknown'}
CREW ABOARD: ${context.crewCount ?? 'unknown'}
CAPTAIN BRIEFING RULES:
- Lead with the single most urgent item (visa expiry first, then customs hold, then berth)
- If alerts exist: name them specifically — "Ahmad Hassan's visa expires in 12 days"
- If customs hold exists: "One shipment is held at customs — TRK-XXXXXX"
- If berth renewal within 30 days: mention it
- If all clear: say exactly "All clear. No alerts today." Nothing else.
- Maximum 3 sentences. No filler words. No preamble. Address captain by first name.
- Never mention financial figures.
- Never use exclamation marks.
- Tone: precise, professional, direct — like a capable crew member giving a handover.
  `.trim();
}
```
---
## PHASE 8 — SIDEBAR NAVIGATION UPDATE (Ticket #143)
In `components/ui/PolarisShell.tsx`, add the captain nav block.
The sidebar renders different nav items per role.
The captain nav is defined in `POLARIS_CAPTAIN_DASHBOARD.md` Section 2.
Key rule: sidebar items are filtered by the user's role AND vessel scope.
Never show a nav link the captain cannot access.
Never show a placeholder or disabled link for unbuilt modules.
---
## PHASE 9 — VERIFICATION CHECKLIST
Before marking any ticket complete, verify:
```
[ ] Migration runs without error in Supabase SQL editor
[ ] RLS policy tested: captain can see own vessel data only
[ ] RLS policy tested: captain CANNOT see another vessel's data
[ ] requireAccess() returns 403 for unauthenticated request
[ ] requireAccess() returns 403 for wrong role (e.g. supplier trying to access)
[ ] Vessel scope check tested: captain assigned to vessel A cannot call /api/captain/vesselB/*
[ ] logAuditEvent() fires on every POST — check audit_log table after test
[ ] Dashboard loads in under 2 seconds (7 parallel fetches)
[ ] getDashboardAlerts sorts: red first, amber second, grey last
[ ] AlertsPanel empty state shows green check + "No alerts today"
[ ] CrewManifestPanel has NO delete button for captain role
[ ] Documents page has NO delete button for captain role
[ ] RequestSupportModal submits and shows success toast
[ ] Emergency page renders with NO network request (static content)
[ ] Leo briefing is <= 3 sentences for captain role
[ ] Finance data is hidden/blurred if user lacks finance permission
[ ] ShipSync customs_hold appears in AlertsPanel AND ShipSyncPanel
[ ] Mobile layout checked at 390px viewport width
[ ] All colours sourced from lib/tokens.ts — no hardcoded hex in components
```
---
## TICKET SUMMARY FOR MATT
| Ticket | Priority | What to build                                                    |
|--------|----------|------------------------------------------------------------------|
| #146   | HIGH     | Captain dashboard page.tsx + PolarisShell captain nav            |
| #147   | HIGH     | VesselBanner component                                           |
| #148   | HIGH     | AlertsPanel + getDashboardAlerts utility                         |
| #149   | HIGH     | CrewManifestPanel                                                |
| #150   | HIGH     | VisaCentrePanel + VisaStatusPipeline                             |
| #151   | HIGH     | ShipSyncPanel + ShipmentProgressBar                              |
| #152   | HIGH     | RequestSupportButton + RequestSupportModal (8 categories)        |
| #153   | HIGH     | ModuleGrid (8 tiles with badge counts)                           |
| #154   | HIGH     | Migrations 015-019 (5 new tables)                                |
| #155   | HIGH     | All captain API routes under /api/captain/[vesselId]/*           |
| #156   | MED      | Documents page (3 sections, no delete)                           |
| #157   | MED      | Crew & Visas page (manifest, add crew, upload passport)          |
| #158   | MED      | Visa Centre page (5 application types, pipeline view)            |
| #159   | MED      | Bunkering page (request form, quotations, history)               |
| #160   | MED      | Berthing page (current berth card, request form)                 |
| #161   | MED      | Crew Care page (transport, medical, welfare, tracking)           |
| #162   | MED      | Financials page (view + download only, finance-gated amounts)    |
| #163   | MED      | Emergency page (static contacts, incident report form)           |
| #164   | MED      | UAE Intelligence page (live info + guide library)                |
| #165   | LOW      | Leo system prompt extension — captain context block              |
---
*Polaris Captain Dashboard — Claude Code Build Instructions*
*JLS Yachts LLC · Internal · Confidential · June 2026*
