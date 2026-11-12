import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowClockwiseIcon,
  HeadphonesIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneNumberField } from "@/components/phone-number-field";
import {
  listCallAgents,
  upsertCallAgent,
} from "@/lib/call-crm.functions";
import { getSupervisorSnapshot } from "@/lib/telnyx.functions";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  head: () => ({
    meta: [
      { title: "Agents | SomeoneNear admin" },
      {
        name: "description",
        content: "Manage SomeoneNear listener agents, schedules and availability.",
      },
      { property: "og:title", content: "Agents | SomeoneNear admin" },
      {
        property: "og:description",
        content: "Manage listener agents and availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AgentsPage,
});

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
  max_concurrent: "1",
};

function message(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Please refresh and try again.";
}

function AgentsPage() {
  const queryClient = useQueryClient();
  const listAgentsFn = useServerFn(listCallAgents);
  const saveAgentFn = useServerFn(upsertCallAgent);
  const snapshotFn = useServerFn(getSupervisorSnapshot);

  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const agents = useQuery({
    queryKey: ["call-agents"],
    queryFn: () => listAgentsFn(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const snapshot = useQuery({
    queryKey: ["supervisor-snapshot"],
    queryFn: () => snapshotFn(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const presence = new Map(
    (snapshot.data?.roster ?? []).map((agent: any) => [
      agent.id,
      agent.presence ?? "offline",
    ]),
  );

  const save = useMutation({
    mutationFn: () =>
      saveAgentFn({
        data: {
          name: draft.name.trim(),
          email: draft.email.trim() || null,
          phone: draft.phone.trim() || null,
          timezone: draft.timezone.trim() || "Asia/Kolkata",
          skills: draft.skills
            .split(",")
            .map((skill) => skill.trim().toLowerCase())
            .filter(Boolean),
          work_start: draft.work_start,
          work_end: draft.work_end,
          max_concurrent: Number(draft.max_concurrent) || 1,
          is_active: true,
        },
      }),
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      queryClient.invalidateQueries({ queryKey: ["call-agents"] });
      queryClient.invalidateQueries({ queryKey: ["supervisor-snapshot"] });
      toast.success("Agent added");
    },
    onError: (error: unknown) => toast.error(message(error)),
  });

  const toggleActive = useMutation({
    mutationFn: (agent: any) =>
      saveAgentFn({
        data: {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          timezone: agent.timezone,
          skills: agent.skills,
          work_start: agent.work_start.slice(0, 5),
          work_end: agent.work_end.slice(0, 5),
          max_concurrent: agent.max_concurrent,
          is_active: !agent.is_active,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-agents"] });
      queryClient.invalidateQueries({ queryKey: ["supervisor-snapshot"] });
      toast.success("Agent updated");
    },
    onError: (error: unknown) => toast.error(message(error)),
  });

  const rows = agents.data?.agents ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Agents"
        description="Add listeners, manage schedules and monitor live availability."
      >
        <Button
          variant="outline"
          onClick={() => {
            agents.refetch();
            snapshot.refetch();
          }}
        >
          <ArrowClockwiseIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      <section className="mb-6 rounded-3xl border border-border bg-surface p-6 shadow-gentle">
        <h2 className="mb-4 font-display text-base font-medium">
          Add an agent
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Name"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />

          <Input
            type="email"
            placeholder="Account email"
            value={draft.email}
            onChange={(event) =>
              setDraft({ ...draft, email: event.target.value })
            }
          />

          <PhoneNumberField
            value={draft.phone}
            onChange={(phone) => setDraft({ ...draft, phone })}
          />

          <Input
            placeholder="Timezone"
            value={draft.timezone}
            onChange={(event) =>
              setDraft({ ...draft, timezone: event.target.value })
            }
          />

          <Input
            placeholder="Skills, comma separated"
            value={draft.skills}
            onChange={(event) =>
              setDraft({ ...draft, skills: event.target.value })
            }
          />

          <Input
            type="time"
            value={draft.work_start}
            onChange={(event) =>
              setDraft({ ...draft, work_start: event.target.value })
            }
          />

          <Input
            type="time"
            value={draft.work_end}
            onChange={(event) =>
              setDraft({ ...draft, work_end: event.target.value })
            }
          />

          <Input
            type="number"
            min={1}
            max={20}
            value={draft.max_concurrent}
            onChange={(event) =>
              setDraft({ ...draft, max_concurrent: event.target.value })
            }
          />
        </div>

        <Button
          className="mt-4"
          disabled={!draft.name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending && (
            <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add agent
        </Button>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 shadow-gentle">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium">
          <HeadphonesIcon className="h-4 w-4" />
          Agent roster
        </h2>

        {agents.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents have been added.
          </p>
        ) : (
          <div className="max-h-[560px] overflow-auto rounded-2xl border border-border">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border">
                  <th className="p-3">Agent</th>
                  <th className="p-3">Availability</th>
                  <th className="p-3">Working hours</th>
                  <th className="p-3">Skills</th>
                  <th className="p-3">Capacity</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((agent) => {
                  const currentPresence = String(
                    presence.get(agent.id) ?? "offline",
                  ).replace("_", " ");

                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="p-3">
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.email ?? "No account email"}
                        </p>
                      </td>

                      <td className="p-3">
                        <Badge
                          variant={
                            currentPresence === "available"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {currentPresence}
                        </Badge>
                      </td>

                      <td className="p-3">
                        {agent.work_start.slice(0, 5)} to{" "}
                        {agent.work_end.slice(0, 5)}
                        <p className="text-xs text-muted-foreground">
                          {agent.timezone}
                        </p>
                      </td>

                      <td className="p-3">
                        {agent.skills.length
                          ? agent.skills.join(", ")
                          : "General"}
                      </td>

                      <td className="p-3">{agent.max_concurrent}</td>

                      <td className="p-3">
                        <Badge
                          variant={agent.is_active ? "default" : "outline"}
                        >
                          {agent.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleActive.isPending}
                          onClick={() => toggleActive.mutate(agent)}
                        >
                          {agent.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
