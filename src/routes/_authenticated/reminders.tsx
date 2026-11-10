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
  ChatCircleTextIcon,
  DeviceMobileIcon,
  ShieldCheckIcon,
  PaperPlaneRightIcon,
} from "@phosphor-icons/react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { MedicationOnboarding } from "@/components/medication-onboarding";
import { GoogleCalendarCard } from "@/components/google-calendar-card";
import { NotificationPermissionStatus } from "@/features/notifications/permission-status";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  sendReminderSmsNudge,
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
              🔔 ③ Phone Alerts &amp; Sync
            </TabsTrigger>
          </TabsList>
          <TabsContent value="medication" className="mt-0 space-y-6">
            <MedicationOnboarding setupOpen={setupOpen} onSetupOpenChange={setSetupOpen} />
          </TabsContent>
          <TabsContent value="everyday" className="mt-0">
            <EverydayReminders />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0 space-y-6">
            {/* Tier 1: 1-Click Native Phone & App Push */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-gentle">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BellRingingIcon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium">1-Click Phone &amp; Device Alerts</h3>
                  <p className="text-sm text-muted-foreground">
                    Instant lock screen reminders with sound &amp; vibration without downloading calendar files.
                  </p>
                </div>
              </div>
              <NotificationPermissionStatus />
            </div>

            {/* Tier 2: Enterprise Telnyx SMS Escalation Nudge */}
            <EnterpriseSmsNudgeCard />

            {/* Health & HIPAA Lock Screen Privacy Mode */}
            <LockScreenPrivacyModeCard />

            {/* Optional Calendar Integrations */}
            <section className="sn-midnight-panel sn-companion-memory">
              <span className="sn-worker-status">📅 Calendar Sync (Optional)</span>
              <h2>Google &amp; Apple Calendar Sync</h2>
              <p>
                Prefer your standard phone calendar? Open Parent &amp; Self Reminders and choose Download calendar on a saved reminder to import into Apple, Google, or Outlook Calendar.
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

function EnterpriseSmsNudgeCard() {
  const [phone, setPhone] = useState("");
  const [sampleReminder, setSampleReminder] = useState("Luke warm water (or medication)");
  const sendSmsFn = useServerFn(sendReminderSmsNudge);

  const mutation = useMutation({
    mutationFn: (e164: string) =>
      sendSmsFn({
        data: {
          phone: e164,
          reminder_title: sampleReminder,
          time_label: "08:00 AM",
        },
      }),
    onSuccess: (res) => {
      if (res.success) {
        gentleToast("SMS Nudge Dispatched", "A live reminder text was sent via Telnyx.");
      } else {
        gentleProblem(
          "SMS delivery failed",
          "Please use international E.164 format (e.g. +1 315-997-8334 or +91...).",
        );
      }
    },
    onError: (err: Error) => gentleProblem("Could not send SMS", err.message),
  });

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-gentle">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ChatCircleTextIcon className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-xl font-medium">Enterprise Telnyx SMS Nudges</h3>
          <p className="text-sm text-muted-foreground">
            Zero-friction fallback. Sends an instant SMS directly to elderly parents or caregivers if app push is delayed.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1.5fr_auto] items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="sms-phone">
            Mobile Number (E.164)
          </label>
          <Input
            id="sms-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 315-997-8334 or +91..."
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="sms-rem">
            Reminder Preview
          </label>
          <Input
            id="sms-rem"
            value={sampleReminder}
            onChange={(e) => setSampleReminder(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <Button
          type="button"
          disabled={!phone.trim() || mutation.isPending}
          onClick={() => mutation.mutate(phone.trim())}
          className="rounded-xl min-h-10"
        >
          {mutation.isPending ? (
            <SpinnerGapIcon className="animate-spin" />
          ) : (
            <PaperPlaneRightIcon className="mr-1.5" />
          )}
          Test SMS Nudge
        </Button>
      </div>
    </div>
  );
}

function LockScreenPrivacyModeCard() {
  const [isDiscreet, setIsDiscreet] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("someonenear_privacy_mode") !== "false";
  });

  const toggle = () => {
    const next = !isDiscreet;
    setIsDiscreet(next);
    localStorage.setItem("someonenear_privacy_mode", String(next));
    gentleToast(
      next ? "Health Privacy Mode Enabled" : "Detailed Notifications Enabled",
      next
        ? "Sensitive medication and dose details are hidden on lock screens (HIPAA aligned)."
        : "Full reminder titles will be visible on lock screens.",
    );
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-gentle">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-xl font-medium">
              Healthcare Privacy &amp; HIPAA Lock Screen Mode
            </h3>
            <p className="text-sm text-muted-foreground">
              {isDiscreet
                ? "Active: Phone lock screen displays a neutral check-in without exposing private medication names to bystanders."
                : "Standard: Exact medication and reminder titles show up directly on phone lock screens."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={isDiscreet ? "default" : "outline"}
          onClick={toggle}
          className="rounded-xl shrink-0"
        >
          {isDiscreet ? "🔒 Discreet Mode: ON" : "🔓 Discreet Mode: OFF"}
        </Button>
      </div>
    </div>
  );
}

function EverydayReminders() {
  const qc = useQueryClient();
  const zone = useTimeZone();
  const listFn = useServerFn(listReminders);
  const createFn = useServerFn(createReminder);
  const doneFn = useServerFn(completeReminder);
  const removeFn = useServerFn(deleteReminder);
  const sendSmsFn = useServerFn(sendReminderSmsNudge);
  const [activeSmsReminder, setActiveSmsReminder] = useState<ReminderRow | null>(null);
  const [smsPhoneInput, setSmsPhoneInput] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [recurrence, setRecurrence] = useState("daily");
  const [time, setTime] = useState("20:00");
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reminders"] });

  const sendSms = useMutation({
    mutationFn: async () => {
      if (!activeSmsReminder || !smsPhoneInput.trim()) return;
      return sendSmsFn({
        data: {
          phone: smsPhoneInput.trim(),
          reminder_title: activeSmsReminder.title,
          time_label: zone.data ? displayTime(activeSmsReminder.due_at, zone.data) : undefined,
        },
      });
    },
    onSuccess: (res) => {
      if (res?.success) {
        gentleToast("SMS Nudge Dispatched", "A reminder text was sent via Telnyx.");
        setActiveSmsReminder(null);
        setSmsPhoneInput("");
      } else {
        gentleProblem(
          "SMS delivery failed",
          "Please verify the phone number format (+1... or +91...).",
        );
      }
    },
    onError: (err: Error) => gentleProblem("Could not send SMS", err.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const session = !auth.user ? (await supabase.auth.getSession()).data.session : null;
      const uid = auth.user?.id || session?.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const targetZone = zone.data || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
      let day = localInput(new Date(), targetZone).slice(0, 10);
      let due = localToUtc(`${day}T${valid.time}`, targetZone);
      if (Date.parse(due) < Date.now()) {
        day = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
        due = localToUtc(`${day}T${valid.time}`, targetZone);
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
      void reminders.refetch();
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveSmsReminder(reminder);
                      }}
                    >
                      <DeviceMobileIcon className="mr-1" /> SMS Nudge
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

      {/* Enterprise SMS Nudge Dialog */}
      <Dialog
        open={!!activeSmsReminder}
        onOpenChange={(open) => !open && setActiveSmsReminder(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogTitle className="font-display text-xl">Send Telnyx SMS Nudge</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Deliver an instant SMS reminder for <strong>{activeSmsReminder?.title}</strong> directly
            to any mobile number (no app or calendar setup needed).
          </DialogDescription>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <label htmlFor="modal-sms-phone" className="text-sm font-medium">
                Phone Number (E.164 with country code)
              </label>
              <Input
                id="modal-sms-phone"
                value={smsPhoneInput}
                onChange={(e) => setSmsPhoneInput(e.target.value)}
                placeholder="+1 315-997-8334 or +91..."
                className="rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setActiveSmsReminder(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                disabled={!smsPhoneInput.trim() || sendSms.isPending}
                onClick={() => sendSms.mutate()}
                className="rounded-xl"
              >
                {sendSms.isPending ? (
                  <SpinnerGapIcon className="animate-spin" />
                ) : (
                  <PaperPlaneRightIcon className="mr-1.5" />
                )}
                Send SMS Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
