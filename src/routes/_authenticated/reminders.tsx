import { z } from "zod";
import { useTimeZone } from "@/lib/frontend/use-time-zone";
import { displayTime, localInput, localToUtc } from "@/lib/frontend/time";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  BellRingingIcon,
  CheckIcon,
  SpinnerGapIcon,
  PillIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { MedicationOnboarding } from "@/components/medication-onboarding";
import { GoogleCalendarCard } from "@/components/google-calendar-card";
import { MedicationCalendarPrompt } from "@/components/medication-calendar-prompt";
import { getGoogleCalendarStatus } from "@/lib/google-calendar.functions";
import { listMedications } from "@/lib/medications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuietEmptyState } from "@/components/quiet-empty-state";
import { gentleProblem, gentleToast } from "@/components/gentle-nudge";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
} from "@/lib/reminders.functions";
import { supabase } from "@/integrations/supabase/client";
import { downloadReminderCalendar } from "@/lib/reminder-calendar";

export const Route = createFileRoute("/_authenticated/reminders")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { action?: "new-reminder" | "add-medication" } => ({
    action:
      search.action === "new-reminder" || search.action === "add-medication"
        ? search.action
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Medication Reminders · SomeoneNear" },
      {
        name: "description",
        content:
          "Add prescriptions, set gentle medication check-ins, and keep everyday reminders together with SomeoneNear.",
      },
      { property: "og:title", content: "Medication Reminders · SomeoneNear" },
      {
        property: "og:description",
        content:
          "A calm, accessible place for prescriptions, medicines, daily doses, and everyday reminders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemindersPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="rounded-3xl border border-border bg-surface p-6 text-base text-foreground">
        We could not open your reminders.{" "}
        {error instanceof Error ? error.message : "Please try again."}
      </div>
    </AppShell>
  ),
});

const CATEGORIES = [
  { value: "general", label: "Personal" },
  { value: "hydration", label: "Water" },
  { value: "exercise", label: "Move / rest" },
  { value: "appointment", label: "Appointment" },
  { value: "birthday", label: "Birthday" },
  { value: "other", label: "Something else" },
] as const;

const RECURRENCES = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
] as const;

type ReminderRow = {
  id: string;
  title: string;
  due_at: string;
  category: string;
  recurrence: string | null;
};

function RemindersPage() {
  const { action } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [selectedTab, setSelectedTab] = useState("medication");
  const [setupOpen, setSetupOpen] = useState(false);
  useEffect(() => {
    if (!action) return;
    setSelectedTab(action === "new-reminder" ? "everyday" : "medication");
    if (action === "add-medication") setSetupOpen(true);
    void navigate({ search: { action: undefined }, replace: true });
  }, [action, navigate]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("calendar");
    if (flag === "connected")
      gentleToast("Google Calendar connected", "Your reminders will sync from now on.");
    else if (flag === "error")
      gentleProblem("We could not connect Google Calendar", "Please try again.");
    if (flag) {
      params.delete("calendar");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="💊 Page 4 · Photo Meds & Reminders"
          title="Tablets, without the nagging."
          description="A calm place to remember what matters, for you or someone you love."
        >
          <button type="button" className="sn-worker-button" onClick={() => setSetupOpen(true)}>
            📷 + Add Pill-Strip Photo Med
          </button>
        </PageHeader>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-8">
          <TabsList className="sn-worker-subtabs grid h-auto w-full grid-cols-1 sm:grid-cols-3 rounded-2xl bg-surface p-1.5">
            <TabsTrigger
              value="medication"
              className="min-h-12 rounded-xl px-3 text-base data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <PillIcon className="mr-2 size-5" /> ① Medication Log
            </TabsTrigger>
            <TabsTrigger
              value="everyday"
              className="min-h-12 rounded-xl px-3 text-base data-[state=active]:bg-card data-[state=active]:shadow-soft"
            >
              <BellRingingIcon className="mr-2 size-5" /> ② Parent &amp; Self Reminders
            </TabsTrigger>
            <TabsTrigger value="calendar" className="min-h-12 rounded-xl px-3 text-base">
              📅 ③ Calendar & Phone
            </TabsTrigger>
          </TabsList>
          <TabsContent value="medication" className="mt-0 space-y-6">
            <MedicationOnboarding setupOpen={setupOpen} onSetupOpenChange={setSetupOpen} />
          </TabsContent>
          <TabsContent value="everyday" className="mt-0">
            <EverydayReminders />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0">
            <section className="sn-midnight-panel sn-companion-memory">
              <span className="sn-worker-status">📅 Calendar on their phone</span>
              <h2>A gentle nudge, in your calendar.</h2>
              <p>
                Open Parent &amp; Self Reminders and choose Download calendar on a saved reminder.
                Import the file into Apple, Google or Outlook Calendar, then review its time and
                alert. No account connection is required for a download.
              </p>
              <button
                type="button"
                className="sn-worker-button"
                onClick={() => setSelectedTab("everyday")}
              >
                Open your reminders →
              </button>
            </section>
            <GoogleCalendarCard />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/**
 * Picks the right Google Calendar surface for the moment:
 *   - once connected -> the full card, so the sync toggle and disconnect stay
 *     reachable
 *   - medications exist but not connected -> the contextual "add these to your
 *     calendar?" prompt (the point of need)
 *   - no medications yet -> nothing, so a first-time member isn't nagged before
 *     they've added anything
 *
 * The old design showed the full Connect card unconditionally at the top, which
 * asked for calendar access before there was any reason to.
 */
function MedicationCalendarSlot() {
  const statusFn = useServerFn(getGoogleCalendarStatus);
  const listMedsFn = useServerFn(listMedications);

  const status = useQuery({ queryKey: ["google-calendar-status"], queryFn: () => statusFn() });
  const meds = useQuery({ queryKey: ["medications"], queryFn: () => listMedsFn() });

  if (status.isError || meds.isError)
    return (
      <DataError
        retry={() => {
          void status.refetch();
          void meds.refetch();
        }}
      />
    );
  if (status.isPending || meds.isPending) return <DataSkeleton />;
  if (status.data?.connected) return <GoogleCalendarCard />;

  const hasMedications = Array.isArray(meds.data) && meds.data.length > 0;
  return <MedicationCalendarPrompt hasMedications={hasMedications} />;
}

function EverydayReminders() {
  const qc = useQueryClient();
  const zone = useTimeZone();
  const listFn = useServerFn(listReminders);
  const createFn = useServerFn(createReminder);
  const doneFn = useServerFn(completeReminder);
  const removeFn = useServerFn(deleteReminder);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [recurrence, setRecurrence] = useState("daily");
  const [time, setTime] = useState("20:00");
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reminders"] });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      if (!zone.data) throw new Error("Your timezone is still loading.");
      const valid = z
        .object({
          title: z.string().trim().min(1).max(200),
          time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          category: z.enum([
            "general",
            "hydration",
            "exercise",
            "appointment",
            "birthday",
            "other",
          ]),
          recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
        })
        .parse({ title, time, category, recurrence });
      let day = localInput(new Date(), zone.data).slice(0, 10);
      let due = localToUtc(`${day}T${valid.time}`, zone.data);
      if (Date.parse(due) < Date.now()) {
        day = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
        due = localToUtc(`${day}T${valid.time}`, zone.data);
      }
      return createFn({
        data: {
          for_user_id: uid,
          title: valid.title,
          category: valid.category,
          recurrence: valid.recurrence,
          due_at: due,
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      gentleToast("Your reminder is ready");
      invalidate();
    },
    onError: (error: Error) => gentleProblem("We could not save this reminder", error.message),
  });
  const complete = useMutation({
    mutationFn: (id: string) => doneFn({ data: { id } }),
    onSuccess: () => {
      gentleToast("Marked as done");
      invalidate();
    },
    onError: (error: Error) => gentleProblem("We could not update it", error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (error: Error) => gentleProblem("We could not remove it", error.message),
  });
  const rows = (reminders.data ?? []) as ReminderRow[];

  return (
    <div className="space-y-8 animate-gentle-rise">
      <section
        data-page-reveal
        className="rounded-[2.5rem] border border-border bg-card p-5 shadow-gentle sm:p-8"
        aria-labelledby="everyday-title"
      >
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">A gentle nudge</p>
          <h2 id="everyday-title" className="font-display text-2xl font-medium">
            What would you like to remember?
          </h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Water, rest, an appointment, or a family moment, set it once and let us hold it for you.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <label className="text-base font-medium" htmlFor="reminder-title">
              What should we remind you about?
            </label>
            <Input
              id="reminder-title"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Drink a glass of water"
              className="min-h-12 rounded-xl bg-background px-4 text-base md:text-base"
            />
          </div>
          <div className="space-y-2">
            <span className="text-base font-medium">Kind</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-h-12 rounded-xl bg-background px-4 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="py-3 text-base">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-base font-medium" htmlFor="reminder-time">
              Time
            </label>
            <Input
              id="reminder-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="min-h-12 rounded-xl bg-background px-4 text-base md:text-base"
            />
          </div>
          <div className="space-y-2">
            <span className="text-base font-medium">Repeat</span>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="min-h-12 rounded-xl bg-background px-4 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCES.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="py-3 text-base">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="min-h-12 rounded-xl px-5 text-base"
            disabled={!title.trim() || create.isPending || !zone.data}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <SpinnerGapIcon className="animate-spin" /> : <PlusIcon />} Add
          </Button>
        </div>
      </section>

      {zone.isError && <DataError retry={() => void zone.refetch()} />}
      {reminders.isError ? (
        <DataError retry={() => void reminders.refetch()} />
      ) : reminders.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
      ) : rows.length === 0 ? (
        <QuietEmptyState
          variant="breath"
          title="Nothing to remember just yet"
          body="When something comes to mind, add it above. There is no rush."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((reminder) => (
            <Card key={reminder.id} className="rounded-3xl border-border bg-card shadow-gentle">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-medium">{reminder.title}</p>
                  <p className="mt-1 text-base text-muted-foreground">
                    {zone.data ? displayTime(reminder.due_at, zone.data) : "Loading time…"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          downloadReminderCalendar({
                            id: reminder.id,
                            title: reminder.title,
                            dueAt: reminder.due_at,
                            recurrence: reminder.recurrence,
                          });
                        } catch (error) {
                          gentleProblem(
                            "We could not create the calendar file",
                            error instanceof Error ? error.message : "Please try again.",
                          );
                        }
                      }}
                    >
                      📅 Download calendar
                    </Button>
                    <Badge variant="secondary">
                      {CATEGORIES.find((item) => item.value === reminder.category)?.label ??
                        reminder.category}
                    </Badge>
                    {reminder.recurrence && reminder.recurrence !== "none" && (
                      <Badge variant="outline">
                        {RECURRENCES.find((item) => item.value === reminder.recurrence)?.label ??
                          reminder.recurrence}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="min-h-11 min-w-11 rounded-xl"
                    aria-label="Mark done"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(reminder.id)}
                  >
                    <CheckIcon />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="min-h-11 min-w-11 rounded-xl"
                    aria-label="Delete reminder"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(reminder.id)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
