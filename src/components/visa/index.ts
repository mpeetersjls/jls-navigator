/**
 * Polaris Visa Module — Pass 2 component exports
 * Ticket #196 · Migration 053
 *
 * Drop these files into src/components/visa/ and import from this barrel.
 *
 * Usage:
 *   import { VisaStatCards, VisaCrewTable, VesselChannelSelector, VesselReportHistory }
 *     from '@/components/visa';
 */

// ── Stat cards (four metric cards with traffic-light left-border accents) ──────
export { VisaStatCards, VisaStatCard }     from './VisaStatCards';
export type { VisaStatCardsProps, VisaStatCardProps, VisaStatVariant } from './VisaStatCards';

// ── Crew table (card-row list replacing old table-first default) ───────────────
export { VisaCrewTable }                   from './VisaCrewTable';
export type { VisaCrewTableProps, VisaCrewRecord, VisaStatus, SectionVariant } from './VisaCrewTable';

// ── Channel selector (card-select replacing old radio button group) ────────────
export { VesselChannelSelector }           from './VesselChannelSelector';
export type { VesselChannelSelectorProps, DeliveryChannel } from './VesselChannelSelector';

// ── Report history (paginated history list with status chips) ─────────────────
export { VesselReportHistory }             from './VesselReportHistory';
export type { VesselReportHistoryProps, ReportHistoryRecord, ReportSendStatus, ReportChannel } from './VesselReportHistory';
