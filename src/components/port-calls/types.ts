// Agency Module — Port Calls / Inward Clearance (Vertical Slice 1)

export interface CountryOption {
  id: string;
  iso_code: string;
  name: string;
}

export interface AgentOption {
  user_id: string;
  display_name: string | null;
}

export interface ArrivalRow {
  port_call_id: string;
  vessel_name: string | null;
  eta: string | null;
  status_label: string | null;
  assigned_office: string | null;
  assigned_agent_id: string | null;
  steps_outstanding: number;
  steps_completed: number;
  steps_total: number;
}

export type WorkflowStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "rejected"
  | "skipped";

export interface WorkflowStep {
  id: string;
  code: string;
  label: string;
  status: WorkflowStepStatus;
  notes: string | null;
}

export type DocumentValidationStatus =
  | "pending"
  | "valid"
  | "invalid"
  | "expired";

export interface DocumentRow {
  id: string;
  code: string;
  label: string;
  is_mandatory: boolean;
  validation_status: DocumentValidationStatus;
  approval_status: "pending" | "approved" | "rejected";
}

export const STEP_ORDER = [
  "arrival_notice",
  "documentation_verified",
  "government_submission",
  "authority_review",
  "approval_received",
  "arrival_clearance",
  "port_entry",
];

export const COMPLIANCE_COLOR: Record<string, string> = {
  compliant: "#3FAE6A",
  action_required: "#E0B23A",
  critical: "#D14343",
};
