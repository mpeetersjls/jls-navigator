# JLS Navigator — Aquila One

Yacht-operations platform. **TanStack Start** (React 19, file-based routes in `src/routes/`), **Supabase** (Postgres + Auth + Storage), **shadcn/ui + Tailwind**, deployed to **Cloudflare Workers** (`wrangler`, `npm run deploy`). Sidebar nav is defined in `src/components/app-sidebar.tsx`.

## Supabase
- Project ref: **`cqzdroabjcdyncfqwawy`** (`.env` `VITE_SUPABASE_URL`). Use the Supabase MCP for SQL/migrations.
- **Gotcha:** several tables were created out-of-band (Lovable) and aren't in `supabase/migrations/`; generated `types.ts` is often stale → the app queries with `(supabase as any).from(...)`. Verify real schema via `list_tables` before assuming. RLS convention: `auth.role() = 'authenticated'`. ~16 pre-existing tables have **RLS disabled** (security advisor flags them) — out of scope unless asked.
- Server-side admin (bypasses RLS) for server functions: `supabaseAdmin` from `src/integrations/supabase/client.server.ts`.

## Server logic & secrets
- TanStack `createServerFn({method}).handler(async (ctx:{data}) => …)`. No `validator()` in this version → call sites pass `({ data } as any)`. Anonymous calls work (auth attacher only adds a bearer when a session exists).
- Email: `sendEmail()` in `src/lib/ses.server.ts` (AWS SES).
- Secrets are Cloudflare Worker secrets via `npx wrangler secret put NAME` (NOT in files). Currently set: `SUPABASE_SERVICE_ROLE_KEY`, `AWS_ACCESS_KEY_ID/SECRET/SES_REGION/SES_FROM_EMAIL`, `MYGPS_ACCESS_TOKEN`. `VITE_APP_URL` is a wrangler var.

## Modules added (2026-06-09)
- **Service Desk** (Yacht IT Solutions → `/it-tickets`): `it_tickets` + `it_ticket_messages`, components in `src/components/service-desk/`. Conversation-first ticket detail.
- **Guides** (sidebar "Guides" group → `/guides`): `guides` table, `src/components/guides/`. URL param is a slug; `guides.department` stores the label — resolve with `departmentLabel()`.
- **Documents & e-Sign** (Modules → `/esign`; public signing at `/sign/$token`): `esign_documents` + `esign_events`, `src/lib/esign.server.ts`, `src/components/esign/`, pdf-lib. Public route is outside `_app` (no auth gate).
- **Live Fleet Tracking — vehicles** (Transport & Fleet → `/fleet-tracking`): native Leaflet map + by-vehicle/by-driver toggle overlay. `src/lib/mygps.server.ts` (myGPS/GPS-Server.net `ax` API: `ax/user/login.php?sid=<MYGPS_ACCESS_TOKEN>` → PILOTID cookie → `ax/current_data.php`). Positions matched to `crew_vehicles` by registration plate and **persisted** (location cols on `crew_vehicles`, synced on view + via the 15-min cron in `src/worker-entry.ts`). Map is lazy-loaded (`src/components/fleet-map.tsx`) — Leaflet touches `window`, app is SSR'd.
- **My Fleet — vessels** (Overview → `/my-fleet`; button on Vessel Overview): VesselFinder `aismap.js` embed using the public **Fleet key** (`src/components/my-fleet-page.tsx`).

## Pending / follow-ups
- **Deploy:** run `npm run deploy` to ship the vehicle tracker overlay + wiring + My Fleet (committed but not yet deployed at handoff).
- **Vessel live-location columns + underway/departed/arrived timestamps** on Vessel Overview need the **paid VesselFinder Fleet Positions API** userkey (free Fleet key = embed only; plan tracks 10/36 vessels). Container tracking key has 0 credits.
- **Driver linkage** is best-effort (myGPS driver name stored on the vehicle, not hard-FK'd to `crew_drivers` — names differ). A per-vehicle GPS/driver picker ("manual mapping") is the next step if wanted.
- e-Sign v1 is a simple signature block; drag-drop field placement / multiple signers are future.

## Build/verify
- **Always run from this repo root** (`D:\Github\jls-navigator`). `npx vite build` regenerates the route tree + bundles; `npx tsc --noEmit` for types (a pre-existing `worker-entry.ts` `handleRequest` arity error is unrelated and harmless — esbuild build ignores it).
- Production deploy is sensitive — only `npm run deploy` when the user asks.
