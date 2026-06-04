import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage, type ResourceConfig } from "@/components/resource-page";
import { Cpu } from "lucide-react";

const config: ResourceConfig = {
  table: "it_tickets",
  title: "IT Support Tickets",
  breadcrumb: "Yacht IT Solutions",
  singular: "Ticket",
  icon: <Cpu className="h-4 w-4 text-primary/80" />,
  statusKey: "status",
  emptyHint: "Raise and track IT support requests across the fleet — connectivity, cyber security, hardware and networks.",
  orderBy: { col: "created_at", asc: false },
  statusLabels: { open: "Open", in_progress: "In Progress", waiting: "Waiting", resolved: "Resolved", closed: "Closed" },
  statusColors: {
    open: "bg-blue-500/15 text-blue-500", in_progress: "bg-amber-500/15 text-amber-500",
    waiting: "bg-violet-500/15 text-violet-500", resolved: "bg-emerald-500/15 text-emerald-500",
    closed: "bg-slate-500/15 text-slate-400",
    urgent: "bg-red-500/15 text-red-500", high: "bg-amber-500/15 text-amber-500",
    normal: "bg-muted text-muted-foreground", low: "bg-slate-500/15 text-slate-400",
  },
  fields: [
    { key: "subject", label: "Subject", required: true, table: true, full: true },
    { key: "yacht_id", label: "Vessel", type: "yacht", table: true },
    { key: "category", label: "Category", type: "select", table: true,
      options: ["connectivity", "cyber_security", "hardware", "software", "network", "general"] },
    { key: "priority", label: "Priority", type: "select", table: true, badge: true,
      options: ["urgent", "high", "normal", "low"] },
    { key: "status", label: "Status", type: "select", table: true, badge: true,
      options: ["open", "in_progress", "waiting", "resolved", "closed"] },
    { key: "requested_by", label: "Requested By" },
    { key: "assigned_to", label: "Assigned To", table: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "resolution", label: "Resolution", type: "textarea" },
  ],
};

export const Route = createFileRoute("/_app/it-tickets")({
  component: () => <ResourcePage config={config} />,
  head: () => ({ meta: [{ title: "IT Support Tickets — Aquila One" }] }),
});
