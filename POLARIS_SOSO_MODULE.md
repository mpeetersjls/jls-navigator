# POLARIS – SIGN ON / SIGN OFF MODULE
## Crew Immigration & Vessel Movement Integration
### CLAUDE.md — Developer Reference

**Module:** Sign On / Sign Off (SOSO)  
**Integrates With:** Crew Visa & Immigration Module, Vessel Records, Reporting Dashboard  
**Platform:** Polaris — Superyacht Crew & Operations Management  
**Organisation:** JLS Yachts LLC / Superyacht Middle East  
**Last Updated:** June 2026  
**Status:** Specification Ready — Commit to Main  
**Reference Form:** JLS Weekly Seaport Immigration Sign On & Sign Off Request Form

---

## 1. Purpose & Design Principle

The Sign On / Sign Off module eliminates duplicate data entry by making a single crew movement submission the authoritative source of truth for all downstream records.

**One entry. Everything updates.**

When a Sign On / Sign Off record is submitted, Polaris must automatically update:

- Crew profile
- Crew visa status
- Crew immigration status
- Crew movement history
- Crew timeline
- Vessel crew list
- Weekly immigration reports
- Reporting dashboard
- Permanent audit trail

This module is not a standalone form. It is a trigger that propagates across the entire platform.

---

## 2. Database Schema

### `crew_movements`

```sql
id                    UUID PRIMARY KEY
vessel_id             UUID REFERENCES vessels(id) NOT NULL
crew_member_id        UUID REFERENCES crew_members(id) NOT NULL
movement_type         VARCHAR(10) NOT NULL           -- SIGN_ON | SIGN_OFF
status                VARCHAR(20) DEFAULT 'PENDING'  -- see MOVEMENT_STATUS enum

-- Flight details
airline               VARCHAR(100)
flight_number         VARCHAR(20)
departure_airport     VARCHAR(10)                    -- IATA code
arrival_airport       VARCHAR(10)                    -- IATA code
departure_datetime    TIMESTAMPTZ
arrival_datetime      TIMESTAMPTZ

-- Logistics
driver_assigned       UUID REFERENCES users(id)      -- driver or coordinator
pickup_required       BOOLEAN DEFAULT FALSE
pickup_time           TIMESTAMPTZ
crew_contact_number   VARCHAR(30)

-- Admin
submitted_by          UUID REFERENCES users(id)
remarks               TEXT
week_commencing       DATE                           -- for weekly report grouping

created_at            TIMESTAMPTZ DEFAULT NOW()
updated_at            TIMESTAMPTZ DEFAULT NOW()
```

### `crew_timeline_events`

```sql
id                    UUID PRIMARY KEY
crew_member_id        UUID REFERENCES crew_members(id) NOT NULL
vessel_id             UUID REFERENCES vessels(id)
event_type            VARCHAR(50) NOT NULL           -- see TIMELINE_EVENT enum
event_datetime        TIMESTAMPTZ NOT NULL
reference_id          UUID                           -- FK to source record (movement, visa, etc.)
reference_type        VARCHAR(50)                    -- 'crew_movement' | 'visa_application' | etc.
notes                 TEXT
created_by            UUID REFERENCES users(id)
created_at            TIMESTAMPTZ DEFAULT NOW()
```

### Enums

```sql
-- MOVEMENT_STATUS
'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

-- TIMELINE_EVENT
'VISA_APPLICATION_SUBMITTED'
'VISA_APPROVED'
'VISA_REJECTED'
'UAE_ENTRY'
'SIGN_ON'
'SIGN_OFF'
'UAE_EXIT'
'VISA_CANCELLATION'
'PERMIT_ISSUED'
'PERMIT_EXPIRED'
```

---

## 3. Required Form Fields

### Header (both Sign On and Sign Off)

| Field | Type | Behaviour |
|---|---|---|
| Vessel Name | Auto-populate | From logged-in vessel user session; back-office selects from dropdown |
| Vessel ID | Hidden / system | Auto-resolved from vessel name |
| Vessel Flag | Auto-populate | From vessel record |
| Captain | Auto-populate | From vessel record |
| Management Company | Auto-populate | From vessel record (if applicable) |
| Week Commencing Date | Date picker | Groups record into weekly report |

### Per-Crew Row Fields

| Field | Type | Notes |
|---|---|---|
| Crew Member Name | Auto-complete + manual | Auto-populate from crew profile search; manual entry fallback |
| Movement Type | Dropdown | `SIGN ON` / `SIGN OFF` |
| Flight Date | Date picker | |
| Flight Time | Time picker | |
| Airline | Text input | |
| Flight Number | Text input | e.g. EK204 |
| Departure Airport | Text + IATA lookup | e.g. LHR |
| Arrival Airport | Text + IATA lookup | e.g. DXB |
| Departure Time | Time picker | |
| Arrival Time | Time picker | |
| Driver Assigned | User dropdown | Filtered to drivers / coordinators |
| Pickup Required | Toggle | YES / NO |
| Pickup Time | Time picker | Conditional — shown only if Pickup Required = YES |
| Crew Contact Number | Phone input | |
| Remarks / Notes | Text area | Optional |

> **Polaris Rule:** A captain or operations coordinator must be able to submit a crew movement record in two clicks from the vessel dashboard. Pre-population from crew profiles is mandatory, not optional.

---

## 4. Vessel Auto-Population Logic

```
IF logged-in user role IN ['Captain', 'Chief Engineer', 'Officer', 'Crew']:
  vessel_id = user.assigned_vessel_id
  vessel fields auto-populate, read-only

IF logged-in user role IN ['Operations', 'Technical', 'Admin', 'Management']:
  vessel selector dropdown shown
  vessel fields populate on vessel selection, editable
```

---

## 5. Visa Module Integration

Sign On / Sign Off must not operate independently from the Crew Visa & Immigration Module.

### On SIGN_ON submission — auto-update:

```
crew_members.current_vessel_id      = vessel_id
crew_members.onboard_status         = 'ONBOARD'
crew_visa_records.immigration_status = 'SIGNED_ON'
vessel_crew_lists                   → add or confirm crew member entry
crew_timeline_events                → insert SIGN_ON event
```

### On SIGN_OFF submission — auto-update:

```
crew_members.current_vessel_id      = NULL
crew_members.onboard_status         = 'SIGNED_OFF'
crew_visa_records.immigration_status = 'SIGNED_OFF'
vessel_crew_lists                   → mark crew member as departed
crew_timeline_events                → insert SIGN_OFF event
```

### Visibility Rule

Every crew movement must be visible within:
- The crew member's Visa & Immigration section
- The vessel's Crew List view
- The crew member's full profile timeline

---

## 6. Crew Timeline

A chronological audit trail must be generated and displayed within each crew member's profile.

### Timeline Event Order (standard lifecycle)

```
1.  Visa Application Submitted
2.  Visa Approved
3.  Entry into UAE
4.  Sign On
5.  Sign Off
6.  Exit from UAE
7.  Visa Cancellation  (if applicable)
```

### Display Requirements

- Rendered as a vertical timeline component within the crew profile
- Each event shows: event type label, date/time, vessel name (if applicable), submitted by
- Events are non-editable — append-only
- Events from all modules feed into this single timeline (visa, movement, permit)

---

## 7. Automation Triggers

On submission of any Sign On / Sign Off record, the following must fire automatically — no manual steps required:

```
① Update crew_members.onboard_status
② Update crew_members.current_vessel_id
③ Update crew_visa_records.immigration_status
④ Update vessel_crew_lists
⑤ Insert event into crew_timeline_events
⑥ Notify: Operations Team (in-app + email)
⑦ Notify: Visa Department (in-app + email)
⑧ Create permanent audit record (append-only, no deletes)
⑨ Link all supporting documents to crew profile
```

All nine steps must complete within the same transaction. If any step fails, the submission must roll back and surface an error to the submitting user.

---

## 8. Notifications

### Recipient Matrix

| Event | Operations | Visa Dept | Captain | Crew Member |
|---|---|---|---|---|
| Sign On submitted | ✓ | ✓ | ✓ | — |
| Sign Off submitted | ✓ | ✓ | ✓ | — |
| Pickup confirmed | ✓ | — | ✓ | ✓ |
| Movement completed | ✓ | ✓ | ✓ | — |

---

## 9. Reports

### 9.1 Crew Movement Report

**Route:** `/reports/crew-movement`

**Filters:**

| Filter | Type |
|---|---|
| Vessel | Dropdown (multi-select) |
| Date Range | Date range picker |
| Crew Member | Search / auto-complete |
| Nationality | Dropdown |
| Movement Type | Sign On / Sign Off / Both |

**Export formats:** PDF, Excel (.xlsx), CSV

---

### 9.2 Auto-Generated Immigration Reports

The following reports must be generated automatically — no manual compilation:

| Report | Trigger | Frequency |
|---|---|---|
| Weekly Immigration Sign On Report | Weekly (Monday 07:00 GST) | Weekly |
| Weekly Immigration Sign Off Report | Weekly (Monday 07:00 GST) | Weekly |
| Vessel Crew Movement Summary | On any movement submission | Real-time |
| Crew Currently Onboard Report | On any movement submission | Real-time |
| Crew Awaiting Arrival Report | When Sign On record status = CONFIRMED | Real-time |
| Crew Scheduled to Depart Report | When Sign Off record status = CONFIRMED | Real-time |

All reports must be accessible from the Operations dashboard and from individual vessel records.

---

## 10. API Endpoints

```
POST    /api/movements                         Submit Sign On / Sign Off record
GET     /api/movements                         List movements (filtered)
GET     /api/movements/:id                     Get single movement record
PATCH   /api/movements/:id                     Update movement record
PATCH   /api/movements/:id/status              Update movement status

GET     /api/crew/:crewId/timeline             Get full crew timeline
GET     /api/crew/:crewId/movements            Get all movements for a crew member

GET     /api/vessels/:vesselId/crew-list       Get current crew onboard
GET     /api/vessels/:vesselId/movements       Get vessel movement history

GET     /api/reports/crew-movement             Crew movement report (filtered)
GET     /api/reports/weekly-sign-on            Weekly Sign On report
GET     /api/reports/weekly-sign-off           Weekly Sign Off report
GET     /api/reports/crew-onboard              Crew currently onboard (all vessels)
GET     /api/reports/crew-arriving             Crew awaiting arrival
GET     /api/reports/crew-departing            Crew scheduled to depart
```

---

## 11. Frontend Components Required

| Component | Description |
|---|---|
| `MovementForm` | Multi-row Sign On / Sign Off submission form |
| `VesselAutoPopulate` | Reads vessel from session or presents dropdown |
| `CrewSearchInput` | Auto-complete crew search with manual fallback |
| `FlightDetailsBlock` | Airline, flight no., departure/arrival airports + times |
| `PickupToggle` | Conditional pickup time field |
| `CrewTimeline` | Chronological event timeline within crew profile |
| `MovementStatusBadge` | Visual status indicator for each movement record |
| `CrewOnboardList` | Real-time list of crew currently onboard a vessel |
| `MovementReportView` | Filterable report with PDF/Excel/CSV export |
| `WeeklyImmigrationReport` | Auto-generated weekly report view |

---

## 12. Reference: JLS Weekly Seaport Immigration Form

The existing paper form (`JLS_Weekly_Seaport_Immigration_Sign_On_Sign_Off_Request_Form.pdf`) defines the baseline field set. The Polaris implementation supersedes this form entirely.

**Field mapping from paper form → Polaris:**

| Paper Form Field | Polaris Field |
|---|---|
| Vessel Name | `vessel.name` (auto-populated) |
| Date | `week_commencing` |
| Crew Name | `crew_member_id` → `crew_members.full_name` |
| Flight Date | `departure_datetime` (date component) |
| Flight Time | `departure_datetime` (time component) |
| Flight No. | `flight_number` |
| Sign On (YES/NO) | `movement_type = SIGN_ON` |
| Sign Off (YES/NO) | `movement_type = SIGN_OFF` |
| Pick-Up (YES/NO) | `pickup_required` |
| Pick-up Time | `pickup_time` |
| Crew Contact No. | `crew_contact_number` |

Fields added in Polaris (not on paper form): Airline, Departure Airport, Arrival Airport, Arrival Time, Driver Assigned, Remarks, and all downstream auto-population.

---

## 13. Build Notes for Matt

- The `crew_timeline_events` table is **append-only**. No UPDATE or DELETE operations permitted. Ever.
- All nine automation triggers (Section 7) must execute within a single database transaction with full rollback on failure.
- Vessel auto-population is based on session context — vessel users never see a vessel selector; back-office users always do.
- The weekly immigration reports must be available as both a scheduled auto-export (Monday 07:00 GST) and an on-demand pull from the Operations dashboard.
- IATA airport code lookup: use a static lookup table or a lightweight external API — do not require free-text airport entry as the only option.
- The `crew_movements` table feeds directly into the `crew_visa_records` table. Ensure the FK relationship is enforced and visa status fields are updated atomically with the movement record.
- Polaris Rule applies: a captain submitting a full crew movement list for the week must not require more than two clicks to reach the submission form from the vessel dashboard.
- All export formats (PDF, Excel, CSV) must be generated server-side. Do not rely on client-side rendering for report exports.
