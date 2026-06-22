# POLARIS – ORBIT MODULE
## Operations & Technical Support
### CLAUDE.md — Developer Reference

**Module:** ORBIT  
**Platform:** Polaris — Superyacht Crew & Operations Management  
**Organisation:** JLS Yachts LLC / Superyacht Middle East  
**Last Updated:** June 2026  
**Status:** Specification Ready for Build

---

## 1. Module Overview

ORBIT is the central operational hub within Polaris. It consolidates all technical, maintenance, marina, environmental, and support service requests across vessels, crew, owners, suppliers, and the JLS Operations team into a single platform.

### Core Objectives

- One-click service request creation
- Centralised supplier management
- Transparent quotation workflows
- Real-time status tracking
- Compliance documentation storage
- Complete audit trail
- Mobile-friendly request submission
- Automated reporting and KPI tracking

---

## 2. User Roles & Access

### Vessel Users

| Role | Access Level |
|---|---|
| Captain | Full vessel request management, approval authority |
| Chief Engineer | Technical service requests, equipment records |
| Officer | Request creation, status monitoring |
| Crew | Request creation only |

### JLS Internal Users

| Role | Access Level |
|---|---|
| Operations Team | Full request handling, supplier coordination |
| Technical Team | Technical service assignment and monitoring |
| Logistics Team | Parts, delivery, rental coordination |
| Finance Team | Invoice processing, cost reporting |
| Management | Full read access, KPI dashboards |

### External Users

| Role | Access Level |
|---|---|
| Approved Suppliers | Assigned job visibility, quote submission |
| Contractors | Job-specific access |
| Service Partners | Scoped to assigned work orders |

---

## 3. ORBIT Dashboard

**Route:** `/orbit` or `/orbit/dashboard`

### Dashboard Widgets

#### Open Requests (Status Summary)

Display request counts grouped by status:

- `AWAITING_QUOTATION`
- `AWAITING_APPROVAL`
- `SCHEDULED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

#### Quick Action Buttons

Seven primary action buttons rendered as tappable tiles:

```
[ Request Technical Service ]   [ Request Waste Collection ]
[ Request Marina Support    ]   [ Request Fuel             ]
[ Request Equipment Rental  ]   [ Request Gas Refill       ]
[ Emergency Assistance      ]
```

Emergency Assistance tile: visually distinct (red/alert styling), triggers priority routing.

#### Recent Activity Feed

- Latest quotations received
- Active jobs (in progress)
- Outstanding invoices
- Compliance alerts

---

## 4. Database Schema

### `orbit_service_requests`

```sql
id                  UUID PRIMARY KEY
vessel_id           UUID REFERENCES vessels(id)
requested_by        UUID REFERENCES users(id)
category            VARCHAR(50)       -- see SERVICE_CATEGORY enum
request_type        VARCHAR(100)
title               VARCHAR(255)
description         TEXT
urgency             VARCHAR(20)       -- CRITICAL | HIGH | MEDIUM | LOW
status              VARCHAR(30)       -- see REQUEST_STATUS enum
assigned_coordinator UUID REFERENCES users(id)
assigned_supplier   UUID REFERENCES suppliers(id)
marina              VARCHAR(100)
scheduled_date      TIMESTAMPTZ
completed_at        TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```

### `orbit_quotations`

```sql
id                  UUID PRIMARY KEY
request_id          UUID REFERENCES orbit_service_requests(id)
supplier_id         UUID REFERENCES suppliers(id)
amount              DECIMAL(12,2)
currency            VARCHAR(3) DEFAULT 'USD'
valid_until         DATE
notes               TEXT
status              VARCHAR(20)       -- PENDING | ACCEPTED | REJECTED
submitted_at        TIMESTAMPTZ
reviewed_at         TIMESTAMPTZ
reviewed_by         UUID REFERENCES users(id)
created_at          TIMESTAMPTZ DEFAULT NOW()
```

### `orbit_documents`

```sql
id                  UUID PRIMARY KEY
request_id          UUID REFERENCES orbit_service_requests(id)
document_type       VARCHAR(50)       -- CERTIFICATE | RECEIPT | REPORT | INVOICE | DISPOSAL_CERT
file_url            TEXT
uploaded_by         UUID REFERENCES users(id)
expires_at          DATE
created_at          TIMESTAMPTZ DEFAULT NOW()
```

### `orbit_activity_log`

```sql
id                  UUID PRIMARY KEY
request_id          UUID REFERENCES orbit_service_requests(id)
actor_id            UUID REFERENCES users(id)
action              VARCHAR(100)
notes               TEXT
created_at          TIMESTAMPTZ DEFAULT NOW()
```

### Enums

```sql
-- SERVICE_CATEGORY
'TECHNICAL_MARINE' | 'NAVIGATION_ELECTRONICS' | 'ELECTRICAL_AUTOMATION'
'SAFETY_COMPLIANCE' | 'ENVIRONMENTAL_MONITORING' | 'MARINA_SUPPORT'
'WASTE_MANAGEMENT' | 'TENDER_JETSKI_SEABOB' | 'EQUIPMENT_RENTAL'
'FUEL_BUNKERING' | 'GAS_CYLINDER'

-- REQUEST_STATUS
'DRAFT' | 'SUBMITTED' | 'AWAITING_QUOTATION' | 'AWAITING_APPROVAL'
'APPROVED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
```

---

## 5. Service Categories

### 5.1 Technical & Marine Services

**Category key:** `TECHNICAL_MARINE`

Sub-categories and request types:

**Hull & Underwater**
- Hull Cleaning
- Propeller Polishing
- Underwater Inspection
- Diver Services

**Mechanical Services**
- Engine Diagnostics
- Tank Cleaning
- Machinery Repair
- Generator Support

**Dry Dock Support**
- Dry Dock Coordination
- Trakhees M-NOC Applications
- Contractor Access
- Technical Attendance

**Marine Coatings**
- Painting
- Protective Coatings
- Touch-Up Repairs

---

### 5.2 Navigation & Electronics

**Category key:** `NAVIGATION_ELECTRONICS`

Request types:
- AIS Installation / Programming
- Radar Service
- ECDIS Support
- GPS Calibration
- Compass Adjustment
- Echo Sounder Service
- Speed Log Calibration
- GMDSS Testing
- VHF / MF / HF Repair
- Navigation Light Repairs
- Emergency Technical Attendance

**Required fields for this category:**

```
equipment_make      VARCHAR(100)
equipment_model     VARCHAR(100)
serial_number       VARCHAR(100)
fault_description   TEXT
urgency             ENUM (CRITICAL | HIGH | MEDIUM | LOW)
```

---

### 5.3 Electrical & Automation

**Category key:** `ELECTRICAL_AUTOMATION`

**Electrical**
- Megger Testing
- Circuit Breaker Testing
- Battery Inspection
- Electrical Troubleshooting
- Distribution Testing

**Automation**
- PLC Testing
- Generator Controls
- VFD Systems
- Rudder Systems
- Control Panels

---

### 5.4 Safety & Compliance

**Category key:** `SAFETY_COMPLIANCE`

**Safety Systems**
- Fire Alarm Testing
- BNWAS Inspection
- Dead Man Alarm Testing
- Emergency Shutdown Testing
- Navigation Light Testing

**Certification Services**
- Safety Equipment Inspection
- Lifeboat Certification
- Compliance Surveys
- Statutory Support

**Required uploads:**
- Existing Certificates
- Survey Reports
- Vessel Class Details

---

### 5.5 Environmental & Monitoring

**Category key:** `ENVIRONMENTAL_MONITORING`

**Monitoring Systems**
- Gas Detection Calibration
- Vapour Monitoring
- Temperature Monitoring
- Environmental Monitoring

**Specialist Surveys**
- Thermography
- Noise Surveys
- Water Analysis
- HIFOG Testing
- Condition Monitoring

---

### 5.6 Marina Support Services

**Category key:** `MARINA_SUPPORT`

Request types:
- Gate Pass Processing
- Marina Access
- Contractor Access
- Spare Parts Delivery
- Launch Boat Services
- Tender Transport
- Slipway Coordination
- Garbage Documentation

**Workflow:**

```
Request → Approval → Permit Processing → Execution → Completion
```

---

### 5.7 Waste Management (MARPOL)

**Category key:** `WASTE_MANAGEMENT`

Waste categories:
- Sludge
- Bilge Water
- Grey Water
- Sewage
- Waste Oil
- Garbage
- Hazardous Waste
- Medical Waste
- Electrical Waste
- Safety Equipment Disposal

**Required fields:**

```
vessel_name         VARCHAR(100)
marina              VARCHAR(100)
waste_type          VARCHAR(50)
quantity            DECIMAL(10,2)
unit                VARCHAR(20)       -- litres, kg, m³
preferred_date      DATE
```

**Auto-generated documents upon completion:**
- Collection Receipt
- Disposal Certificate
- Environmental Compliance Certificate

---

### 5.8 Jet Ski, Tender & Seabob Services

**Category key:** `TENDER_JETSKI_SEABOB`

**Jet Ski**
- Annual Service
- Diagnostics
- Battery Replacement
- Electrical Repairs
- Hull Repairs

**Tender**
- Engine Service
- Steering Repairs
- Hull Repairs
- Control Systems

**Seabob**
- Diagnostics
- Battery Health
- Battery Replacement
- Performance Testing

---

### 5.9 Equipment Rental

**Category key:** `EQUIPMENT_RENTAL`

**Lifting Equipment**
- Crane
- Forklift
- Manlift
- Boom Lift

**Temporary Infrastructure**
- Portable Generator
- Temporary Shore Power
- Lighting Towers

**Marine Equipment**
- Tender Trailer
- Support Boats
- MasterCraft
- Tender Boat

**Rental period options:**
- `HOURLY` | `DAILY` | `WEEKLY` | `MONTHLY`

---

### 5.10 Fuel & Bunkering

**Category key:** `FUEL_BUNKERING`

**Required fields:**

```
fuel_type           VARCHAR(50)
quantity            DECIMAL(10,2)
unit                VARCHAR(20)       -- litres, MT
marina              VARCHAR(100)
required_date       DATE
delivery_window     VARCHAR(100)      -- e.g. "08:00–12:00"
```

**Features:**
- Multiple supplier quote comparison
- Fuel price comparison view
- Delivery tracking
- Bunker documentation storage

---

### 5.11 Gas Cylinder & Certification Services

**Category key:** `GAS_CYLINDER`

**Medical Gases:** Oxygen, Medical Air, Breathing Air, Nitrous Oxide  
**Fire & Safety:** CO₂, FM200, Novec 1230, SCBA, EEBD  
**Industrial Gases:** Nitrogen, Argon, Helium, Hydrogen, Acetylene  
**LPG Services:** LPG, Propane, Butane, CNG, LNG Coordination  

**Compliance Services:**
- Hydrostatic Testing
- Certification
- Valve Replacement
- Leak Testing

---

## 6. Workflow Engine

All requests follow a 10-step lifecycle:

```
Step 1   →  Create Request
Step 2   →  Assign Service Category
Step 3   →  Auto-Route to Operations
Step 4   →  Obtain Quotations
Step 5   →  Client Approval
Step 6   →  Supplier Assignment
Step 7   →  Work Execution
Step 8   →  Completion Confirmation
Step 9   →  Invoice Processing
Step 10  →  Archive & Reporting
```

### Status Transitions

```
DRAFT
  └→ SUBMITTED
       └→ AWAITING_QUOTATION
            └→ AWAITING_APPROVAL
                 └→ APPROVED
                      └→ SCHEDULED
                           └→ IN_PROGRESS
                                └→ COMPLETED
                                └→ CANCELLED (any stage)
```

---

## 7. Automation & SLA

### SLA Response Targets

| Urgency | Target Response |
|---|---|
| CRITICAL | 1 Hour |
| HIGH | 4 Hours |
| MEDIUM | 24 Hours |
| LOW | 72 Hours |

### Smart Notifications

Trigger notifications to the following roles on status change:

- Captain (vessel owner of the request)
- Requestor (originating user)
- Assigned Coordinator (JLS Operations)
- Supplier (when assigned or quoted)

### Auto-Escalation Path

```
Operations Coordinator  (SLA breach T+0)
  → Operations Manager  (SLA breach T+2hr)
    → Department Head   (SLA breach T+4hr)
```

---

## 8. Reporting

### Vessel-Level Reports

- Open Jobs
- Completed Jobs
- Service History
- Environmental Compliance Record
- Certification Status

### Management Reports

- Revenue by Service Type
- Supplier Performance Metrics
- Average Response Time by Category
- Open Requests by Vessel
- Monthly Operations Summary

---

## 9. API Endpoints

```
POST    /api/orbit/requests                    Create new service request
GET     /api/orbit/requests                    List requests (filtered)
GET     /api/orbit/requests/:id                Get single request
PATCH   /api/orbit/requests/:id                Update request
PATCH   /api/orbit/requests/:id/status         Update status

POST    /api/orbit/requests/:id/quotations      Submit quotation
PATCH   /api/orbit/requests/:id/quotations/:qid Approve/reject quotation

POST    /api/orbit/requests/:id/documents       Upload document
GET     /api/orbit/requests/:id/documents       List documents

GET     /api/orbit/reports/vessel/:vesselId     Vessel report
GET     /api/orbit/reports/management           Management dashboard data
```

---

## 10. Frontend Components Required

| Component | Description |
|---|---|
| `OrbitDashboard` | Main dashboard with widgets and quick actions |
| `RequestList` | Filterable, sortable table of all requests |
| `RequestForm` | Multi-step request creation form (category-aware) |
| `RequestDetail` | Full request view with timeline, documents, quotes |
| `QuotationPanel` | Quote submission and comparison view |
| `DocumentUpload` | File upload with type classification |
| `WasteRequestForm` | MARPOL-specific request form |
| `FuelRequestForm` | Bunkering-specific request form |
| `RentalRequestForm` | Equipment rental form with period selector |
| `SLAIndicator` | Visual urgency/SLA status badge |
| `ActivityTimeline` | Audit log rendered as a timeline |
| `OrbitReports` | Reporting and KPI dashboard |

---

## 11. LEO AI Integration (Future Phase)

Leo, the Polaris embedded AI agent, will extend ORBIT with:

- Supplier recommendation based on service type and history
- Quotation comparison and anomaly flagging
- Predictive maintenance requirements from service history
- Automated scope of work drafting
- Service report review and summarisation
- Recurring vessel issue identification
- Monthly operational summary generation

**Target outcome:** 60% reduction in Operations administration time.

---

## 12. Build Notes for Matt

- ORBIT is a standalone module but shares the `vessels`, `users`, `suppliers`, and `organisations` tables from the Polaris core schema.
- All requests must be scoped to a `vessel_id` — no orphan requests.
- The `orbit_activity_log` table is append-only. No deletes, no updates.
- Emergency Assistance requests bypass the quotation step and route directly to `IN_PROGRESS` with immediate SLA clock start.
- MARPOL waste documents (Collection Receipt, Disposal Certificate, Environmental Compliance Certificate) must be auto-generated as PDFs on job completion — stub this for now, implement in Phase 2.
- All monetary values stored in USD; display currency conversion handled client-side.
- Supplier access is scoped: a supplier can only see requests assigned to them.
- Polaris Rule applies: no user should require more than two clicks to submit any request from the ORBIT dashboard.
