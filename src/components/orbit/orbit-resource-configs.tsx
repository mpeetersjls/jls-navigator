/**
 * Shared ResourceConfig objects for the generic ORBIT sub-pages (Defects &
 * Repairs, Planned Maintenance). Used by both the standalone Old View routes
 * (src/routes/_app.orbit.defects.tsx, _app.orbit.maintenance.tsx) and the
 * New View OrbitHub tabs, so the two surfaces can't drift apart.
 */
import type { ResourceConfig } from "@/components/resource-page";
import { Wrench } from "lucide-react";

export const ORBIT_DEFECTS_CONFIG: ResourceConfig = {
  table: "orbit_defects",
  title: "Defects & Repairs",
  breadcrumb: "Orbit / Operations",
  singular: "Defect",
  icon: <Wrench className="h-4 w-4 text-primary/80" />,
  statusKey: "status",
  emptyHint: "Log vessel defects and track them through to repair.",
  orderBy: { col: "reported_date", asc: false },
  statusLabels: { open: "Open", in_progress: "In Progress", awaiting_parts: "Awaiting Parts", resolved: "Resolved" },
  statusColors: {
    open: "bg-red-500/15 text-red-500", in_progress: "bg-amber-500/15 text-amber-500",
    awaiting_parts: "bg-violet-500/15 text-violet-500", resolved: "bg-emerald-500/15 text-emerald-500",
    critical: "bg-red-500/15 text-red-500", major: "bg-amber-500/15 text-amber-500", minor: "bg-slate-500/15 text-slate-400",
  },
  fields: [
    { key: "title", label: "Defect", required: true, table: true, full: true },
    { key: "yacht_id", label: "Vessel", type: "yacht", table: true },
    { key: "system_area", label: "System / Area", type: "select", table: true,
      options: ["Engine", "Deck", "Electrical", "Plumbing", "HVAC", "Hull", "Navigation", "Other"] },
    { key: "severity", label: "Severity", type: "select", table: true, badge: true, options: ["critical", "major", "minor"] },
    { key: "status", label: "Status", type: "select", table: true, badge: true, options: ["open", "in_progress", "awaiting_parts", "resolved"] },
    { key: "reported_by", label: "Reported By" },
    { key: "reported_date", label: "Reported", type: "date", table: true },
    { key: "target_date", label: "Target Date", type: "date", table: true },
    { key: "description", label: "Description", type: "textarea" },
  ],
};

export const ORBIT_MAINTENANCE_CONFIG: ResourceConfig = {
  table: "orbit_maintenance",
  title: "Planned Maintenance",
  breadcrumb: "Orbit / Operations",
  singular: "Task",
  icon: <Wrench className="h-4 w-4 text-primary/80" />,
  statusKey: "status",
  emptyHint: "Schedule planned maintenance by calendar or running hours and track what's due.",
  orderBy: { col: "next_due", asc: true },
  statusLabels: { scheduled: "Scheduled", due: "Due", overdue: "Overdue", completed: "Completed" },
  statusColors: {
    scheduled: "bg-blue-500/15 text-blue-500", due: "bg-amber-500/15 text-amber-500",
    overdue: "bg-red-500/15 text-red-500", completed: "bg-emerald-500/15 text-emerald-500",
  },
  fields: [
    { key: "task", label: "Task", required: true, table: true, full: true },
    { key: "yacht_id", label: "Vessel", type: "yacht", table: true },
    { key: "component", label: "Component", table: true },
    { key: "interval_type", label: "Interval Type", type: "select", options: ["calendar", "running_hours"] },
    { key: "frequency", label: "Frequency", table: true, placeholder: "e.g. Every 250 hrs / Monthly" },
    { key: "last_done", label: "Last Done", type: "date" },
    { key: "next_due", label: "Next Due", type: "date", table: true },
    { key: "status", label: "Status", type: "select", table: true, badge: true, options: ["scheduled", "due", "overdue", "completed"] },
    { key: "assigned_to", label: "Assigned To", table: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
};
