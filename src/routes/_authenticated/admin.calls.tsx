import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Flag,
  Loader2,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { AppShell, PageHeader } from "@/components/app-shell";
import { isCurrentUserAdmin } from "@/lib/feedback-admin.functions";
import {
  assignBookingAgent,
  autoAssignBooking,
  listCallAgents,
  listCallFlags,
  listCallQueue,
  raiseCallFlag,
  resolveCallFlag,
  setBookingCrmState,
  upsertCallAgent,
} from "@/lib/call-crm.functions";
import {
  getRoutingConfig,
  getSupervisorSnapshot,
  saveRoutingConfig,
} from "@/lib/telnyx.functions";
import {
  CRM_STATES,
  SLA_META,
  STATE_META,
  slaLevel,
  type CrmState,
  type QueueRow,
} from "@/lib/call-crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/calls")({
  head: () => ({
    meta: [
      { title: "Call operations · SomeoneNear admin" },
      {
        name: "description",
        content: "Queue, agent routing, SLA tracking and flags for SomeoneNear listener calls.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminCallsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-red-600">Something went wrong: {error.message}</div>
  ),
});

const ACTIVE_STATES: CrmState[] = ["requested", "assigned", "confirmed", "in_call"];

function AdminCallsPage() {
  const adminFn = useServerFn(isCurrentUserAdmin);
  const { data: adminCheck, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminFn(),
  });

  if (checkingAdmin) {
    return (
      <AppShell>
        <div className="space-y-3 p-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Admin"
          title="Call operations"
          description="You don't have access to this panel."
        />
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm underline">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </AppShell>
    );
  }

  return <CallsConsole />;
}

function CallsConsole() {
  const qc = useQueryClient();
  const queueFn = useServerFn(listCallQueue);
  const agentsFn = useServerFn(listCallAgents);
  const flagsFn = useServerFn(listCallFlags);
  const autoAssignFn = useServerFn(autoAssignBooking);
  const assignFn = useServerFn(assignBookingAgent);
  const stateFn = useServerFn(setBookingCrmState);
  const flagFn = useServerFn(raiseCallFlag);
  const resolveFn = useServerFn(resolveCallFlag);
  const upsertAgentFn = useServerFn(upsertCallAgent);

  const [showAll, setShowAll] = useState(false);

  const queue = useQuery({
    queryKey: ["call-queue"],
    queryFn: () => queueFn(),
    refetchInterval: 60_000,
  });
  const agents = useQuery({ queryKey: ["call-agents"], queryFn: () => agentsFn() });
  const flags = useQuery({
    queryKey: ["call-flags"],
    queryFn: () => flagsFn(),
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["call-queue"] });
    qc.invalidateQueries({ queryKey: ["call-flags"] });
  };

  const autoAssign = useMutation({
    mutationFn: (id: string) => autoAssignFn({ data: { id } }),
    onSuccess: (res: any) => {
      invalidate();
      if (res?.ok) toast.success(`Assigned to ${res.agent} (score ${res.score})`);
      else toast.warning(res?.reason ?? "Could not assign.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setState = useMutation({
    mutationFn: (v: { id: string; crm_state: CrmState }) => stateFn({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("State updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const manualAssign = useMutation({
    mutationFn: (v: { id: string; agent_id: string }) => assignFn({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("Agent assigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const raise = useMutation({
    mutationFn: (booking_id: string) =>
      flagFn({
        data: { booking_id, kind: "other", severity: "high", note: "Raised from queue board" },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Flag raised");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Flag resolved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = queue.data?.rows ?? [];
  const visible = useMemo(
    () => (showAll ? rows : rows.filter((r) => ACTIVE_STATES.includes(r.crm_state))),
    [rows, showAll],
  );
  const breached = rows.filter(
    (r) => slaLevel(r.requested_at, r.crm_state) === "breached" && ACTIVE_STATES.includes(r.crm_state),
  ).length;
  const openFlags = (flags.data?.flags ?? []).filter((f) => !f.resolved);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Call operations"
        description="Queue, routing, SLA ladder and flags for every listener call."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile icon={<PhoneCall className="h-4 w-4" />} label="Active calls in queue" value={rows.filter((r) => ACTIVE_STATES.includes(r.crm_state)).length} />
        <StatTile icon={<ShieldAlert className="h-4 w-4" />} label="SLA breached" value={breached} tone={breached ? "text-red-600" : undefined} />
        <StatTile icon={<Flag className="h-4 w-4" />} label="Open flags" value={openFlags.length} tone={openFlags.length ? "text-amber-600" : undefined} />
      </div>

      <section className="mb-8 rounded-brand border border-border bg-card/60 p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Queue board</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show active only" : "Show all"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => queue.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
            </Button>
          </div>
        </header>

        {queue.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in the queue right now.</p>
        ) : (
          <div className="space-y-3">
            {visible.map((row) => (
              <QueueCard
                key={row.id}
                row={row}
                agents={agents.data?.agents ?? []}
                busy={autoAssign.isPending || setState.isPending}
                onAutoAssign={() => autoAssign.mutate(row.id)}
                onAssign={(agentId) => manualAssign.mutate({ id: row.id, agent_id: agentId })}
                onState={(s) => setState.mutate({ id: row.id, crm_state: s })}
                onFlag={() => raise.mutate(row.id)}
              />
            ))}
          </div>
        )}
      </section>

      <SupervisorBoard />



      <section className="mb-8 rounded-brand border border-border bg-card/60 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Flag className="h-4 w-4" /> Flag inbox
        </h2>
        {flags.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (flags.data?.flags ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No flags raised.</p>
        ) : (
          <ul className="space-y-2">
            {(flags.data?.flags ?? []).map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{f.kind}</span>{" "}
                  <Badge variant="outline" className="ml-1 text-[11px]">
                    {f.severity}
                  </Badge>
                  {f.resolved && (
                    <Badge variant="outline" className="ml-1 text-[11px]">
                      resolved
                    </Badge>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {f.note ?? "—"} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!f.resolved && (
                  <Button size="sm" variant="outline" onClick={() => resolve.mutate(f.id)}>
                    Resolve
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AgentRoster
        agents={agents.data?.agents ?? []}
        loading={agents.isLoading}
        onSave={async (payload) => {
          await upsertAgentFn({ data: payload });
          qc.invalidateQueries({ queryKey: ["call-agents"] });
          toast.success("Agent saved");
        }}
      />
    </AppShell>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-brand border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function QueueCard({
  row,
  agents,
  busy,
  onAutoAssign,
  onAssign,
  onState,
  onFlag,
}: {
  row: QueueRow;
  agents: { id: string; name: string }[];
  busy: boolean;
  onAutoAssign: () => void;
  onAssign: (agentId: string) => void;
  onState: (s: CrmState) => void;
  onFlag: () => void;
}) {
  const sla = slaLevel(row.requested_at, row.crm_state);
  const slaMeta = SLA_META[sla];
  const stateMeta = STATE_META[row.crm_state];
  const startsAt = new Date(row.requested_at);

  return (
    <article
      className={`rounded-brand border p-3 ${
        sla === "breached"
          ? "border-red-300 bg-red-50/60"
          : sla === "urgent"
            ? "border-orange-300 bg-orange-50/50"
            : sla === "warn"
              ? "border-amber-300 bg-amber-50/40"
              : "border-border bg-background/60"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={stateMeta.className}>
          {stateMeta.label}
        </Badge>
        <Badge variant="outline" className={slaMeta.className}>
          {slaMeta.label}
        </Badge>
        {row.open_flags > 0 && (
          <Badge variant="outline" className="border-red-200 bg-red-100 text-red-800">
            {row.open_flags} flag{row.open_flags > 1 ? "s" : ""}
          </Badge>
        )}
        <span className="text-sm font-medium">
          {startsAt.toLocaleString()} · {row.duration_minutes}m
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(startsAt, { addSuffix: true })}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Agent: <span className="font-medium">{row.agent_name ?? "unassigned"}</span> · Listener:{" "}
        {row.listener_name ?? "—"}
      </p>
      {row.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onAutoAssign} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
          Auto-assign
        </Button>

        <Select onValueChange={onAssign}>
          <SelectTrigger className="h-9 w-[170px] text-xs">
            <SelectValue placeholder="Assign agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.length === 0 ? (
              <SelectItem value="none" disabled>
                No agents yet
              </SelectItem>
            ) : (
              agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={row.crm_state} onValueChange={(v) => onState(v as CrmState)}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATE_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={onFlag}>
          <Flag className="mr-1.5 h-4 w-4" /> Flag
        </Button>
      </div>
    </article>
  );
}

type AgentDraft = {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  skills: string;
  work_start: string;
  work_end: string;
  max_concurrent: string;
};

const EMPTY_DRAFT: AgentDraft = {
  name: "",
  email: "",
  phone: "",
  timezone: "Asia/Kolkata",
  skills: "",
  work_start: "09:00",
  work_end: "21:00",
  max_concurrent: "3",
};

function AgentRoster({
  agents,
  loading,
  onSave,
}: {
  agents: {
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
  }[];
  loading: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Agent name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        timezone: draft.timezone.trim() || "UTC",
        skills: draft.skills
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        work_start: draft.work_start,
        work_end: draft.work_end,
        max_concurrent: Number(draft.max_concurrent) || 3,
        is_active: true,
      });
      setDraft(EMPTY_DRAFT);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-brand border border-border bg-card/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4" /> Agent roster
      </h2>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No agents yet — add one below so the router has someone to pick.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {agents.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm"
            >
              <span className="font-medium">{a.name}</span>{" "}
              <span className="text-xs text-muted-foreground">
                · {a.timezone} · {a.work_start.slice(0, 5)}–{a.work_end.slice(0, 5)} · max{" "}
                {a.max_concurrent}
              </span>
              {a.skills.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  skills: {a.skills.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
        />
        <Input
          placeholder="Phone"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
        />
        <Input
          placeholder="Timezone (e.g. Asia/Kolkata)"
          value={draft.timezone}
          onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
        />
        <Input
          placeholder="Skills (comma separated)"
          value={draft.skills}
          onChange={(e) => setDraft({ ...draft, skills: e.target.value })}
        />
        <Input
          type="time"
          value={draft.work_start}
          onChange={(e) => setDraft({ ...draft, work_start: e.target.value })}
        />
        <Input
          type="time"
          value={draft.work_end}
          onChange={(e) => setDraft({ ...draft, work_end: e.target.value })}
        />
        <Input
          type="number"
          min={1}
          max={20}
          value={draft.max_concurrent}
          onChange={(e) => setDraft({ ...draft, max_concurrent: e.target.value })}
        />
      </div>
      <Button className="mt-3" size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Add agent
      </Button>
    </section>
  );
}
