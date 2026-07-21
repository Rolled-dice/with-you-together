import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelBooking,
  listMyBookings,
  requestBooking,
  rescheduleBooking,
} from "@/lib/listeners.functions";
import {
  AlarmClockCheck,
  CalendarClock,
  Ear,
  HeartHandshake,
  Loader2,
  PhoneCall,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/listeners")({
  head: () => ({
    meta: [
      { title: "Listeners — WithU" },
      {
        name: "description",
        content:
          "Book a scheduled session with WithU's in-house Listener team. Real people, always with you.",
      },
    ],
  }),
  component: ListenersPage,
});

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

const DEFAULT_TZ =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Kolkata";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ListenersPage() {
  const qc = useQueryClient();
  const listBookingsFn = useServerFn(listMyBookings);
  const requestFn = useServerFn(requestBooking);
  const cancelFn = useServerFn(cancelBooking);
  const rescheduleFn = useServerFn(rescheduleBooking);

  const bookings = useQuery({ queryKey: ["listener-bookings"], queryFn: () => listBookingsFn() });

  const [day, setDay] = useState(tomorrowIso());
  const [time, setTime] = useState("18:00");
  const [tz, setTz] = useState(TIMEZONES.includes(DEFAULT_TZ) ? DEFAULT_TZ : "Asia/Kolkata");
  const [duration, setDuration] = useState(45);
  const [note, setNote] = useState("");

  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyNote, setEmergencyNote] = useState("");

  const book = useMutation({
    mutationFn: (input: {
      preferred_day: string;
      preferred_time: string;
      time_zone: string;
      duration_minutes: number;
      note: string;
      booking_type: "scheduled" | "emergency_callback";
    }) => requestFn({ data: input }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["listener-bookings"] });
      if (vars.booking_type === "emergency_callback") {
        toast.success("Callback requested. A Listener will reach you within the SLA.");
        setEmergencyOpen(false);
        setEmergencyNote("");
      } else {
        toast.success("Booked. We've assigned an in-house Listener.");
        setNote("");
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cancelled.");
      qc.invalidateQueries({ queryKey: ["listener-bookings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const upcoming = useMemo(
    () =>
      (bookings.data ?? []).filter(
        (b) => b.status === "requested" || b.status === "confirmed",
      ),
    [bookings.data],
  );
  const past = useMemo(
    () =>
      (bookings.data ?? []).filter(
        (b) => b.status === "completed" || b.status === "cancelled",
      ),
    [bookings.data],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Listeners"
        slogan="Real ears. Real hearts."
        title="Book a Listener"
        description="Our in-house team is trained to just… listen. Book ahead, and we'll match you with someone from the WithU roster."
      />

      {/* SLA + Rules strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <RuleTile
          icon={AlarmClockCheck}
          title="Scheduled in advance"
          body="Choose a preferred day & time in your timezone. Sessions run 30–60 minutes."
          delay={1}
        />
        <RuleTile
          icon={ShieldCheck}
          title="In-house team, SLA-backed"
          body="Every booking is picked up by a WithU Listener. Confirmed within 15 minutes."
          delay={2}
        />
        <RuleTile
          icon={CalendarClock}
          title="2-hour reschedule rule"
          body="Reschedule up to 2 hours before the start. Later than that, the session counts as used."
          delay={3}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Booking form */}
        <Card className="rounded-brand border-border bg-card animate-slide-in-up stagger-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <HeartHandshake className="h-4 w-4 text-brand-accent" />
              Schedule your next session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="day">Preferred day</Label>
                <Input
                  id="day"
                  type="date"
                  min={tomorrowIso()}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Preferred time</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time zone</Label>
                <Select value={tz} onValueChange={setTz}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((z) => (
                      <SelectItem key={z} value={z}>{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Session length</Label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Anything to share ahead of time? (optional)</Label>
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A word or two about how you're feeling — helps your Listener meet you where you are."
              />
            </div>
            <Button
              onClick={() =>
                book.mutate({
                  preferred_day: day,
                  preferred_time: time,
                  time_zone: tz,
                  duration_minutes: duration,
                  note,
                  booking_type: "scheduled",
                })
              }
              disabled={book.isPending}
              className="w-full rounded-brand bg-neutral-900 text-white hover:-translate-y-0.5 hover:bg-neutral-900"
            >
              {book.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ear className="mr-2 h-4 w-4" />}
              Book with the in-house team
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll be matched with a WithU Listener automatically. No profile picking required.
            </p>
          </CardContent>
        </Card>

        {/* Emergency callback */}
        <Card className="rounded-brand border-2 border-brand-primary/40 bg-gradient-to-br from-brand-primary/10 to-brand-accent/5 animate-slide-in-up stagger-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <PhoneCall className="h-4 w-4 text-brand-accent" />
              Need someone right now?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm text-foreground">
              <FlowStep n={1} text="Tap 'Request callback' below." />
              <FlowStep n={2} text="Our in-house Listener picks it up (SLA: 10 minutes)." />
              <FlowStep n={3} text="You'll get a call notification — join when you're ready." />
            </ol>
            <div className="rounded-brand border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive-foreground/90">
              If you're in danger, please call your local emergency line first.{" "}
              <Link to="/safety" className="underline underline-offset-4">Safety resources →</Link>
            </div>
            {emergencyOpen ? (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="e-note">What's happening? (kept private)</Label>
                <Textarea
                  id="e-note"
                  rows={3}
                  value={emergencyNote}
                  onChange={(e) => setEmergencyNote(e.target.value)}
                  placeholder="A short line so your Listener knows what to hold space for."
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      book.mutate({
                        preferred_day: tomorrowIso(),
                        preferred_time: "12:00",
                        time_zone: tz,
                        duration_minutes: 30,
                        note: emergencyNote,
                        booking_type: "emergency_callback",
                      })
                    }
                    disabled={book.isPending}
                    className="flex-1 rounded-brand gradient-sunrise text-white"
                  >
                    {book.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                    Request callback
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEmergencyOpen(false)}
                    className="rounded-brand"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setEmergencyOpen(true)}
                className="w-full rounded-brand gradient-sunrise text-white"
              >
                <PhoneCall className="mr-2 h-4 w-4" />
                Request an emergency callback
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bookings */}
      <div className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Your sessions</h2>
        {bookings.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-brand" />
            <Skeleton className="h-24 w-full rounded-brand" />
          </div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="Nothing on the calendar yet"
            description="Book your first session above. Our in-house Listener team takes it from there."
          />
        ) : (
          <div className="grid gap-3">
            {upcoming.map((b, i) => (
              <BookingRow
                key={b.id}
                booking={b}
                delay={i + 1}
                onCancel={() => cancel.mutate(b.id)}
                onReschedule={(preferred_day, preferred_time, time_zone) =>
                  rescheduleFn({ data: { id: b.id, preferred_day, preferred_time, time_zone } })
                    .then(() => {
                      toast.success("Rescheduled.");
                      qc.invalidateQueries({ queryKey: ["listener-bookings"] });
                    })
                    .catch((e) => toast.error((e as Error).message))
                }
              />
            ))}
            {past.map((b, i) => (
              <BookingRow key={b.id} booking={b} delay={i + 1} past />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RuleTile({
  icon: Icon,
  title,
  body,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  delay: number;
}) {
  return (
    <div className={`rounded-brand border border-border bg-card p-4 card-lift animate-slide-in-up stagger-${delay}`}>
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/15 text-brand-accent">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function FlowStep({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}

type Booking = {
  id: string;
  requested_at: string;
  duration_minutes: number;
  note: string | null;
  status: string;
  listeners: { name: string } | null;
};

function BookingRow({
  booking,
  onCancel,
  onReschedule,
  past = false,
  delay = 1,
}: {
  booking: Booking;
  onCancel?: () => void;
  onReschedule?: (day: string, time: string, tz: string) => void;
  past?: boolean;
  delay?: number;
}) {
  const when = new Date(booking.requested_at);
  const isEmergency = booking.note?.startsWith("[EMERGENCY_CALLBACK]");
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(booking.requested_at.slice(0, 10));
  const [time, setTime] = useState(booking.requested_at.slice(11, 16));
  const [tz, setTz] = useState(
    booking.note?.match(/\[TZ:([^\]]+)\]/)?.[1] ?? DEFAULT_TZ,
  );

  return (
    <Card
      className={`rounded-brand border-border bg-card animate-slide-in-up stagger-${Math.min(delay, 6)} ${past ? "opacity-70" : ""}`}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">
              {when.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {booking.duration_minutes} min
            </Badge>
            {isEmergency && (
              <Badge className="rounded-full bg-brand-accent text-primary-foreground text-[10px]">
                Callback
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full text-[10px] capitalize">
              {booking.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Listener: {booking.listeners?.name ?? "Assigning…"}
          </p>
        </div>
        {!past && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-brand">
              <Link to="/call/$bookingId" params={{ bookingId: booking.id }}>
                <Video className="mr-1.5 h-4 w-4" /> Join
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-brand"
              onClick={() => setEditing((v) => !v)}
            >
              Reschedule
            </Button>
            {onCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="rounded-brand text-destructive"
                onClick={onCancel}
              >
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        )}
        {editing && !past && (
          <div className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3 animate-fade-in">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-40" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="rounded-brand"
              onClick={() => {
                onReschedule?.(day, time, tz);
                setEditing(false);
              }}
            >
              Confirm change
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Reschedules made within 2 hours of the start will count as used.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
