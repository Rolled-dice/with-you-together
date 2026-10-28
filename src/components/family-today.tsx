import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckIcon,
  ClockIcon,
  PlusIcon,
  ChatCircleIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanionComposer } from "@/components/companion-composer";
import { combineToUtc } from "@/lib/time-zone";
import {
  completeReminder,
  createReminder,
  getFamilyToday,
  shareReminderUpdate,
  snoozeReminder,
} from "@/lib/reminders.functions";
import type { FamilySnapshotData } from "@/lib/family.schemas";
import type { FamilyReminder } from "@/lib/family-reminders.schemas";
import { toast } from "sonner";
import { BackgroundReminders } from "./background-reminders";

export function FamilyToday({
  family,
  selectedPerson,
}: {
  family: FamilySnapshotData;
  selectedPerson?: string;
}) {
  const load = useServerFn(getFamilyToday);
  const done = useServerFn(completeReminder);
  const snooze = useServerFn(snoozeReminder);
  const update = useServerFn(shareReminderUpdate);
  const qc = useQueryClient();
  const [person, setPerson] = useState(
    selectedPerson || (family.myRole === "owner" ? "all" : family.viewer_id),
  );
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FamilyReminder | null>(null);
  const query = useQuery({
    queryKey: ["family-today"],
    queryFn: () => load(),
    refetchInterval: 60_000,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["family-today"] });
    void qc.invalidateQueries({ queryKey: ["reminders"] });
  };
  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "done" | "snooze" }) =>
      kind === "done"
        ? done({ data: { id } })
        : snooze({ data: { id, due_at: new Date(Date.now() + 30 * 60_000).toISOString() } }),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: async (text: string) => {
      if (!editing) return;
      if (text.length > 2000) throw new Error("Keep your update within 2,000 characters.");
      return update({ data: { id: editing.id, update_text: text } });
    },
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast.success("Update saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const rows = (query.data ?? []).filter((row) => person === "all" || row.for_user_id === person);
  return (
    <section className="space-y-5" aria-labelledby="family-today-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="family-today-title" className="text-xl font-bold">
          Today & upcoming
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {family.myRole === "owner" && (
            <select
              aria-label="Show reminders for"
              className="family-select"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="all">Everyone</option>
              {family.members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === family.viewer_id ? "Me" : m.display_name || "Family member"}
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => setAdding(true)}>
            <PlusIcon /> Add reminder
          </Button>
        </div>
      </div>
      {query.isPending && <p role="status">Loading reminders...</p>}
      {query.isError && (
        <div role="alert">
          <p>Reminders could not be loaded.</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && !rows.length && (
        <div className="py-10 text-center">
          <CalendarBlankIcon className="mx-auto mb-3 h-8 w-8 text-brand-accent" />
          <p>No reminders here yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="family-reminder rounded-lg border border-border bg-card p-4 sm:p-5"
          >
            <div className="min-w-0 space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
                <CalendarBlankIcon aria-hidden className="size-4 shrink-0" />
                For{" "}
                {row.for_user_id === family.viewer_id
                  ? "you"
                  : family.members.find((m) => m.user_id === row.for_user_id)?.display_name ||
                    "your family member"}
              </p>
              <h3 className="break-words text-lg font-semibold">{row.title}</h3>
              <p className="text-base text-muted-foreground">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: row.timezone,
                }).format(new Date(row.due_at))}{" "}
                <span className="text-sm">({row.timezone})</span>
              </p>
              {row.description && <p className="break-words">{row.description}</p>}
              <p className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-secondary-foreground">
                {row.status === "done" ? (
                  <CheckIcon aria-hidden className="size-4" />
                ) : (
                  <ClockIcon aria-hidden className="size-4" />
                )}
                {row.status === "done"
                  ? "Done"
                  : row.status === "snoozed"
                    ? "Remind me later"
                    : "No update yet"}
              </p>
              {row.update_text && (
                <p className="whitespace-pre-wrap break-words border-l-2 border-brand-accent pl-3">
                  {row.update_text}
                </p>
              )}
            </div>
            {row.can_complete && (
              <div className="flex flex-wrap items-start gap-2 pt-3">
                {row.status !== "done" && (
                  <>
                    <Button
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: row.id, kind: "done" })}
                    >
                      <CheckIcon />
                      {row.category === "appointment" ? "I attended" : "Done"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: row.id, kind: "snooze" })}
                    >
                      <ClockIcon /> Remind in 30 min
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setEditing(row)}>
                  <ChatCircleIcon /> Add an update
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <BackgroundReminders />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="family-experience max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add reminder</DialogTitle>
          </DialogHeader>
          <FamilyReminderForm
            family={family}
            selected={person}
            onSaved={() => {
              setAdding(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="family-experience max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {family.members.find((m) => m.user_id === family.viewer_id)?.share_updates
              ? "Your family owner can see this update."
              : "Only you can see this update. Sharing is off."}
          </p>
          <CompanionComposer
            inputLabel="Your update"
            sendLabel="Share update"
            placeholder="Tell us how it went."
            initialText={editing?.update_text || ""}
            status={save.isPending ? "submitted" : "ready"}
            disabled={save.isPending}
            onSend={(text) => save.mutateAsync(text).then(() => {})}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FamilyReminderForm({
  family,
  selected,
  onSaved,
}: {
  family: FamilySnapshotData;
  selected: string;
  onSaved: () => void;
}) {
  const recipients = family.members.filter(
    (m) => m.user_id === family.viewer_id || (family.myRole === "owner" && m.receive_reminders),
  );
  const [recipient, setRecipient] = useState(
    recipients.some((m) => m.user_id === selected) ? selected : family.viewer_id,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"general" | "appointment">("general");
  const [due, setDue] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">(
    "none",
  );
  const fn = useServerFn(createReminder);
  const member = recipients.find((m) => m.user_id === recipient);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let previewInstant: string | null = null;
  try {
    previewInstant = combineToUtc(due.slice(0, 10), due.slice(11), browserZone);
  } catch {
    /* Show a preview only for an unambiguous valid time. */
  }
  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          for_user_id: recipient,
          title,
          description,
          due_at: combineToUtc(due.slice(0, 10), due.slice(11), browserZone),
          timezone: member?.timezone || browserZone,
          recurrence,
          category,
        },
      }),
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <label className="grid gap-2">
        For
        <select
          className="family-select"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        >
          {recipients.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.user_id === family.viewer_id ? "Me" : m.display_name || "Family member"}
            </option>
          ))}
        </select>
      </label>
      <div>
        <Label htmlFor="family-reminder-title">Reminder</Label>
        <Input
          id="family-reminder-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <label className="grid gap-2">
        Type
        <select
          className="family-select"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
        >
          <option value="general">Reminder</option>
          <option value="appointment">Doctor appointment</option>
        </select>
      </label>
      <div>
        <Label htmlFor="family-reminder-note">Note (optional)</Label>
        <Input
          id="family-reminder-note"
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="family-reminder-time">Date and time ({browserZone})</Label>
        <Input
          id="family-reminder-time"
          type="datetime-local"
          required
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        {previewInstant && member && (
          <p className="mt-2 text-sm text-muted-foreground">
            For {member.display_name || "you"}:{" "}
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: member.timezone,
            }).format(new Date(previewInstant))}{" "}
            ({member.timezone})
          </p>
        )}
      </div>
      <label className="grid gap-2">
        Repeat
        <select
          className="family-select"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
        >
          {["none", "daily", "weekly", "monthly", "yearly"].map((value) => (
            <option key={value} value={value}>
              {value === "none" ? "Does not repeat" : value[0].toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={mut.isPending}>
        {mut.isPending ? "Saving..." : "Save reminder"}
      </Button>
    </form>
  );
}
