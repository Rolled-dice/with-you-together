export const CRM_STATES = [
  "requested",
  "assigned",
  "confirmed",
  "in_call",
  "completed",
  "missed",
  "escalated",
] as const;
export type CrmState = (typeof CRM_STATES)[number];

export const FLAG_KINDS = [
  "safety",
  "no_show",
  "abuse",
  "tech_failure",
  "sla_breach",
  "other",
] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

export const FLAG_SEVERITIES = ["low", "normal", "high", "urgent"] as const;
export type FlagSeverity = (typeof FLAG_SEVERITIES)[number];

export type CallAgent = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  skills: string[];
  work_start: string;
  work_end: string;
  max_concurrent: number;
  is_active: boolean;
};

export type QueueRow = {
  id: string;
  user_id: string;
  requested_at: string;
  duration_minutes: number;
  note: string | null;
  status: string;
  crm_state: CrmState;
  sla_deadline: string | null;
  agent_id: string | null;
  agent_name: string | null;
  listener_name: string | null;
  open_flags: number;
  contact_phone: string | null;
  profile_phone: string | null;
};


export type CallFlag = {
  id: string;
  booking_id: string;
  kind: string;
  severity: string;
  note: string | null;
  resolved: boolean;
  created_at: string;
};

/** SLA warning ladder for a scheduled call. */
export type SlaLevel = "ok" | "warn" | "urgent" | "breached";

export function slaLevel(startsAtIso: string, state: CrmState, now = Date.now()): SlaLevel {
  if (state === "completed" || state === "in_call") return "ok";
  const ms = new Date(startsAtIso).getTime() - now;
  if (ms < 0) return "breached";
  if (ms <= 60 * 60 * 1000) return "urgent";
  if (ms <= 90 * 60 * 1000) return "warn";
  return "ok";
}

export const SLA_META: Record<SlaLevel, { label: string; className: string }> = {
  ok: { label: "On track", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  warn: { label: "T-90m", className: "bg-amber-100 text-amber-800 border-amber-200" },
  urgent: { label: "T-60m", className: "bg-orange-100 text-orange-900 border-orange-300" },
  breached: { label: "SLA breached", className: "bg-red-100 text-red-800 border-red-300" },
};

export const STATE_META: Record<CrmState, { label: string; className: string }> = {
  requested: { label: "Requested", className: "bg-sky-100 text-sky-800 border-sky-200" },
  assigned: { label: "Assigned", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  confirmed: { label: "Confirmed", className: "bg-teal-100 text-teal-800 border-teal-200" },
  in_call: { label: "In call", className: "bg-violet-100 text-violet-800 border-violet-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  missed: { label: "Missed", className: "bg-neutral-200 text-neutral-700 border-neutral-300" },
  escalated: { label: "Escalated", className: "bg-red-100 text-red-800 border-red-300" },
};
