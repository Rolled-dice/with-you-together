import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  ShieldAlert,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { useSoftphone } from "@/hooks/useSoftphone";
import {
  endTelnyxCall,
  getAgentQueue,
  getCallTimeline,
  getScreenPop,
  getSoftphoneToken,
  setAgentPresence,
  startCall,
  submitDisposition,
  transferCall,
} from "@/lib/telnyx.functions";
import { SLA_META, slaLevel, type CrmState } from "@/lib/call-crm";

export const Route = createFileRoute("/_authenticated/agent/console")({
  head: () => ({
    meta: [
      { title: "Agent console · SomeoneNear" },
      {
        name: "description",
        content: "Softphone, member context and call notes for SomeoneNear listener agents.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AgentConsolePage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Something went wrong: {error.message}</p>
    </AppShell>
  ),
});

const OUTCOMES = [
  { value: "connected", label: "Spoke with the member" },
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "member_declined", label: "Member declined" },
  { value: "tech_failure", label: "Technical failure" },
] as const;

function AgentConsolePage() {
  const qc = useQueryClient();
  const queueFn = useServerFn(getAgentQueue);
  const tokenFn = useServerFn(getSoftphoneToken);
  const popFn = useServerFn(getScreenPop);
  const timelineFn = useServerFn(getCallTimeline);
  const startFn = useServerFn(startCall);
  const endFn = useServerFn(endTelnyxCall);
  const transferFn = useServerFn(transferCall);
  const presenceFn = useServerFn(setAgentPresence);
  const dispositionFn = useServerFn(submitDisposition);

  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("connected");
  const [followUp, setFollowUp] = useState(false);
  const [safety, setSafety] = useState(false);
  const [notes, setNotes] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const getToken = useCallback(async () => tokenFn(), [tokenFn]);
  const phone = useSoftphone(getToken);

  const queue = useQuery({
    queryKey: ["agent-queue"],
    queryFn: () => queueFn(),
    refetchInterval: 30_000,
  });

  const pop = useQuery({
    queryKey: ["agent-screen-pop", selected],
    queryFn: () => popFn({ data: { booking_id: selected! } }),
    enabled: Boolean(selected),
  });

  const timeline = useQuery({
    queryKey: ["agent-timeline", selected],
    queryFn: () => timelineFn({ data: { booking_id: selected! } }),
    enabled: Boolean(selected),
    refetchInterval: 15_000,
  });

  const dial = useMutation({
    mutationFn: async (bookingId: string) => {
      await phone.ensureRegistered();
      await presenceFn({ data: { state: "on_call", booking_id: bookingId } });
      return startFn({ data: { booking_id: bookingId } });
    },
    onSuccess: () => toast.success("Dialling — your headset will ring first, then the member"),
    onError: (e: Error) => toast.error(e.message),
  });

  const end = useMutation({
    mutationFn: async () => {
      if (selected) await endFn({ data: { booking_id: selected } });
      await phone.hangup();
      await presenceFn({ data: { state: "wrap_up", booking_id: selected } });
    },
    onSuccess: () => {
      toast.success("Call ended — add your notes");
      qc.invalidateQueries({ queryKey: ["agent-timeline", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doTransfer = useMutation({
    mutationFn: () => transferFn({ data: { booking_id: selected!, to: transferTo.trim() } }),
    onSuccess: () => {
      setTransferTo("");
      toast.success("Transfer started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: () =>
      dispositionFn({
        data: {
          booking_id: selected!,
          outcome: outcome as never,
          follow_up_needed: followUp,
          safety_concern: safety,
          notes,
        },
      }),
    onSuccess: async () => {
      toast.success("Saved");
      setNotes("");
      setFollowUp(false);
      setSafety(false);
      await presenceFn({ data: { state: "available", booking_id: null } });
      qc.invalidateQueries({ queryKey: ["agent-queue"] });
      qc.invalidateQueries({ queryKey: ["agent-timeline", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = queue.data?.rows ?? [];
  const nextUp = useMemo(() => rows[0]?.id ?? null, [rows]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Agent"
        title="Agent console"
        description="Your queue, the member's context, and a browser headset that calls their phone."
      />

      <SoftphoneDock phone={phone} onGoAvailable={() => presenceFn({ data: { state: "available" } })} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="rounded-brand border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : !queue.data?.agent ? (
              <EmptyState
                icon={<Headphones className="h-5 w-5" />}
                title="You're not on the agent roster"
                description="An admin can add you in Call CRM → Agents, then this console fills with your calls."
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<PhoneCall className="h-5 w-5" />}
                title="Nothing assigned"
                description="Assigned calls appear here with their SLA countdown."
              />
            ) : (
              rows.map((r: any) => {
                const level = slaLevel(r.requested_at, (r.crm_state ?? "assigned") as CrmState);
                const meta = SLA_META[level];
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`w-full rounded-brand border p-3 text-left transition-colors ${
                      selected === r.id ? "border-brand-primary bg-brand-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.member_name}</span>
                      {r.id === nextUp && <Badge variant="secondary">Next up</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(r.requested_at), "EEE d MMM · h:mm a")} ·{" "}
                      {formatDistanceToNowStrict(new Date(r.requested_at), { addSuffix: true })}
                    </p>
                    <Badge className="mt-2" variant="outline">
                      {meta?.label ?? level}
                    </Badge>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <EmptyState
              icon={<PhoneCall className="h-5 w-5" />}
              title="Pick a call"
              description="Choose someone from your queue to see their context and start the call."
            />
          ) : (
            <>
              <Card className="rounded-brand border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Member context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {pop.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {pop.data?.member?.display_name ?? pop.data?.member?.full_name ?? "Member"}
                        </span>
                        {pop.data?.member?.pronouns && (
                          <Badge variant="outline">{pop.data.member.pronouns}</Badge>
                        )}
                        {pop.data?.member?.care_tier && (
                          <Badge variant="secondary">{pop.data.member.care_tier}</Badge>
                        )}
                        {pop.data?.member?.timezone && (
                          <Badge variant="outline">{pop.data.member.timezone}</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        Phone on file: {pop.data?.member?.phone ?? "none"}
                      </p>
                      {pop.data?.booking?.note && (
                        <p className="rounded-brand bg-muted p-3 text-sm">{pop.data.booking.note}</p>
                      )}
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Recent calls
                        </p>
                        {(pop.data?.history ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">First call with us.</p>
                        ) : (
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {pop.data!.history.map((h: any) => (
                              <li key={h.id}>
                                {format(new Date(h.requested_at), "d MMM")} · {h.crm_state}
                                {h.rating ? ` · ${h.rating}★` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {(pop.data?.flags ?? []).some((f: any) => !f.resolved) && (
                        <p className="flex items-center gap-2 rounded-brand bg-destructive/10 p-3 text-xs text-destructive">
                          <ShieldAlert className="h-4 w-4" /> This booking has an open flag — read the
                          notes before you dial.
                        </p>
                      )}
                    </>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={() => dial.mutate(selected)}
                      disabled={dial.isPending || phone.status === "on_call"}
                    >
                      {dial.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Phone className="mr-1.5 h-4 w-4" />
                      )}
                      Call member
                    </Button>
                    <Button variant="destructive" onClick={() => end.mutate()} disabled={end.isPending}>
                      <PhoneOff className="mr-1.5 h-4 w-4" /> End call
                    </Button>
                    <div className="flex gap-2">
                      <Input
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        placeholder="+1... transfer to"
                        className="w-[180px]"
                      />
                      <Button
                        variant="outline"
                        onClick={() => doTransfer.mutate()}
                        disabled={!transferTo.trim() || doTransfer.isPending}
                      >
                        Transfer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-brand border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Wrap-up notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger className="w-full sm:w-[260px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOMES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What happened on the call?"
                    rows={4}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={followUp}
                      onCheckedChange={(v) => setFollowUp(Boolean(v))}
                    />
                    Follow-up needed
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={safety} onCheckedChange={(v) => setSafety(Boolean(v))} />
                    Safety concern (raises an urgent flag)
                  </label>
                  <Button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
                    {saveNotes.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Save and go available
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-brand border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Call timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {(timeline.data?.recordings ?? []).map((rec: any) => (
                    <div key={rec.id} className="flex items-center gap-2">
                      <Play className="h-3.5 w-3.5" />
                      {rec.url ? (
                        <a className="underline" href={rec.url} target="_blank" rel="noreferrer">
                          Recording ({rec.duration_seconds ?? "?"}s)
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Recording processing…</span>
                      )}
                    </div>
                  ))}
                  {(timeline.data?.events ?? []).length === 0 ? (
                    <p className="text-muted-foreground">No events yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {timeline.data!.events.map((e: any) => (
                        <li key={e.id} className="text-muted-foreground">
                          {format(new Date(e.created_at), "HH:mm:ss")} · {e.event_type}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SoftphoneDock({
  phone,
  onGoAvailable,
}: {
  phone: ReturnType<typeof useSoftphone>;
  onGoAvailable: () => void;
}) {
  const label: Record<string, string> = {
    idle: "Headset off",
    connecting: "Connecting…",
    registered: "Ready",
    ringing: "Ringing…",
    on_call: "On a call",
    error: "Problem",
  };

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <Badge variant={phone.status === "on_call" ? "default" : "secondary"}>
          {label[phone.status]}
        </Badge>
        {phone.status === "on_call" && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {Math.floor(phone.seconds / 60)}:{String(phone.seconds % 60).padStart(2, "0")}
          </span>
        )}

        {phone.status === "idle" || phone.status === "error" ? (
          <Button
            size="sm"
            onClick={async () => {
              try {
                await phone.ensureRegistered();
                onGoAvailable();
                toast.success("Headset online — you're ready for calls");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Headset could not come online");
              }
            }}
          >
            <Headphones className="mr-1.5 h-4 w-4" /> Go available
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={phone.toggleMute}>
              {phone.muted ? (
                <MicOff className="mr-1.5 h-4 w-4" />
              ) : (
                <Mic className="mr-1.5 h-4 w-4" />
              )}
              {phone.muted ? "Unmute" : "Mute"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void phone.toggleHold()}>
              <Pause className="mr-1.5 h-4 w-4" /> {phone.held ? "Resume" : "Hold"}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void phone.hangup()}>
              <PhoneOff className="mr-1.5 h-4 w-4" /> Hang up
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void phone.disconnect()}>
              Go offline
            </Button>
          </>
        )}

        {phone.error && <span className="text-xs text-destructive">{phone.error}</span>}
        <audio ref={phone.audioRef} autoPlay className="hidden" />
      </CardContent>
    </Card>
  );
}
