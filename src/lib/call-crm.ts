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
  ok: { label: "On track", className: "border-sage/45 bg-sage/15 text-foreground/80" },
  warn: { label: "T-90m", className: "border-clay-soft/50 bg-clay-soft/18 text-foreground/85" },
  urgent: { label: "T-60m", className: "border-primary/40 bg-primary/12 text-primary" },
  breached: { label: "Needs attention", className: "border-primary/60 bg-primary/20 text-primary" },
};

export const STATE_META: Record<CrmState, { label: string; className: string }> = {
  requested: { label: "Requested", className: "border-sky/60 bg-sky/25 text-foreground/80" },
  assigned: { label: "Assigned", className: "border-lilac bg-lilac/35 text-foreground/80" },
  confirmed: { label: "Confirmed", className: "border-mint bg-mint/30 text-foreground/80" },
  in_call: { label: "In call", className: "border-primary/45 bg-primary/14 text-primary" },
  completed: { label: "Completed", className: "border-sage/50 bg-sage/20 text-foreground/80" },
  missed: { label: "Missed", className: "border-border bg-muted text-muted-foreground" },
  escalated: { label: "Escalated", className: "border-primary/60 bg-primary/20 text-primary" },
};

