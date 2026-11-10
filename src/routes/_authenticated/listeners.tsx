import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { JsonLd } from "@/components/json-ld";
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
  listListeners,
} from "@/lib/listeners.functions";
import { EditorialAvatar, type AvatarAppearance } from "@/components/identity/editorial-avatar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { capabilities, requireCapability } from "@/lib/frontend/capabilities";
import { getFeedbackPrompt } from "@/lib/session-feedback.functions";
import { PostCallFeedbackCard } from "@/components/post-call-feedback-card";
import {
  AlarmIcon,
  CalendarDotIcon,
  EarIcon,
  HandHeartIcon,
  SpinnerGapIcon,
  PhoneIcon,
  PhoneCallIcon,
  ShieldCheckIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/listeners")({
  head: () => ({
    meta: [
      { title: "Listeners | SomeoneNear" },
      {
        name: "description",
        content:
          "Book a scheduled session with SomeoneNear's in-house Listener team. Real people, always with you.",
      },
    ],
  }),
  component: ListenersPage,
});

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": "https://someonenear.com/services/#listener",
      name: "Human Listener Sessions",
      description:
        "Real-time voice sessions for emotional care, facilitated through secure, browser-based calls.",
      serviceType: "Emotional Support",
    },
  ],
};

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

function ListenerAvatar({
  listener,
  size = "lg",
}: {
  listener: { name: string; avatar_url?: string | null };
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const avatarUrl = listener.avatar_url;
  if (avatarUrl) {
    if (
      avatarUrl.startsWith("http://") ||
      avatarUrl.startsWith("https://") ||
      avatarUrl.startsWith("/") ||
      avatarUrl.startsWith("data:")
    ) {
      const dim =
        size === "xl"
          ? "w-28 h-28"
          : size === "lg"
            ? "w-20 h-20"
            : size === "sm"
              ? "w-11 h-11"
              : "w-14 h-14";
      return (
        <img
          src={avatarUrl}
          alt={listener.name}
          className={`${dim} rounded-full object-cover border-[2.5px] border-[#FAF7F2] shadow-[0_8px_20px_rgba(16,47,80,0.22)] flex-shrink-0 select-none`}
        />
      );
    }
    try {
      const parsed = JSON.parse(avatarUrl) as AvatarAppearance;
      if (parsed && typeof parsed === "object") {
        return <EditorialAvatar member={parsed} size={size} />;
      }
    } catch {
      /* parse error, fall through */
    }
  }

  const name = listener.name.toLowerCase();
  let appearance: AvatarAppearance = {
    archetype: "adult-woman",
    skinTone: "#D89B78",
    avatarBg: "#EAB84B",
    outfitColor: "#D95732",
    earrings: "hoops",
    backdropMotif: "leaves",
  };

  if (name.includes("kenji")) {
    appearance = {
      archetype: "adult-man",
      skinTone: "#F0C0A8",
      avatarBg: "#3E5C76",
      outfitColor: "#2B4C7E",
      backdropMotif: "waves",
    };
  } else if (
    name.includes("aarav") ||
    name.includes("rahul") ||
    name.includes("rohan") ||
    name.includes("vikram")
  ) {
    appearance = {
      archetype: "adult-man",
      skinTone: "#C8845A",
      avatarBg: "#2E5B88",
      outfitColor: "#1F3B4D",
      glasses: true,
      backdropMotif: "stripes",
    };
  } else if (
    name.includes("david") ||
    name.includes("marcus") ||
    name.includes("james") ||
    name.includes("robert")
  ) {
    appearance = {
      archetype: "aged-man",
      skinTone: "#E5A98A",
      avatarBg: "#5C527F",
      outfitColor: "#3E2C41",
      glasses: true,
      backdropMotif: "waves",
    };
  } else if (name.includes("riya") || name.includes("ananya") || name.includes("maya")) {
    appearance = {
      archetype: "teenager",
      skinTone: "#D89B78",
      avatarBg: "#3E7B78",
      outfitColor: "#D95732",
      earrings: "pink-hoops",
      backdropMotif: "clouds",
    };
  } else if (name.includes("amara") || name.includes("zainab")) {
    appearance = {
      archetype: "adult-woman",
      skinTone: "#8D5524",
      avatarBg: "#D97724",
      outfitColor: "#3D1220",
      earrings: "tassels",
      backdropMotif: "leaves",
    };
  } else if (name.includes("priya") || name.includes("pooja") || name.includes("neha")) {
    appearance = {
      archetype: "adult-woman",
      skinTone: "#D89B78",
      avatarBg: "#EAB84B",
      outfitColor: "#D95732",
      earrings: "hoops",
      backdropMotif: "leaves",
    };
  } else {
    const isMale =
      /\b(mr|he|him|man|boy|kumar|singh|sharma|patel|john|james|robert|david|alex|kenji|aarav)\b/i.test(
        listener.name,
      );
    let hash = 0;
    for (let i = 0; i < listener.name.length; i++)
      hash = (hash << 5) - hash + listener.name.charCodeAt(i);
    const bgList = ["#EAB84B", "#3E5C76", "#4A7C59", "#D97724", "#2E5B88", "#5C527F", "#3E7B78"];
    appearance = {
      archetype: isMale ? "adult-man" : "adult-woman",
      skinTone: "#E5A98A",
      avatarBg: bgList[Math.abs(hash) % bgList.length],
      outfitColor: isMale ? "#2B4C7E" : "#D95732",
      earrings: isMale ? "none" : "hoops",
    };
  }

  return <EditorialAvatar member={appearance} size={size} />;
}

function ListenersPage() {
  const [section, setSection] = useState("roster");
  const [bookingOpen, setBookingOpen] = useState(false);
  const rosterFn = useServerFn(listListeners);
  const roster = useQuery({ queryKey: ["listeners"], queryFn: () => rosterFn() });
  const qc = useQueryClient();
  const listBookingsFn = useServerFn(listMyBookings);
  const requestFn = useServerFn(requestBooking);
  const cancelFn = useServerFn(cancelBooking);
  const rescheduleFn = useServerFn(rescheduleBooking);
  const feedbackPromptFn = useServerFn(getFeedbackPrompt);

  const bookings = useQuery({ queryKey: ["listener-bookings"], queryFn: () => listBookingsFn() });
  const feedbackPrompt = useQuery({
    queryKey: ["session-feedback-prompt"],
    queryFn: () => feedbackPromptFn(),
  });

  const [day, setDay] = useState(todayIso());
  const [time, setTime] = useState("18:00");
  const [tz, setTz] = useState(TIMEZONES.includes(DEFAULT_TZ) ? DEFAULT_TZ : "Asia/Kolkata");
  const [duration, setDuration] = useState(45);
  const [note, setNote] = useState("");
  const [bookingError, setBookingError] = useState<{
    message: string;
    settingsLink: boolean;
  } | null>(null);

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
    }) => {
      requireCapability("outboundCallBooking");
      return requestFn({ data: input });
    },
    onSuccess: (res, vars) => {
      if (!res.ok) {
        setBookingError({
          message: res.message,
          settingsLink: res.code === "phone_required" || res.code === "phone_verification_required",
        });
        toast.error(res.message);
        return;
      }
      setBookingError(null);
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
    onError: (e) => {
      const message =
        e instanceof Error ? e.message : "We couldn't complete your booking. Please try again.";
      setBookingError({ message, settingsLink: false });
      toast.error(message);
    },
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
    () => (bookings.data ?? []).filter((b) => b.status === "requested" || b.status === "confirmed"),
    [bookings.data],
  );
  const past = useMemo(
    () => (bookings.data ?? []).filter((b) => b.status === "completed" || b.status === "cancelled"),
    [bookings.data],
  );

  return (
    <AppShell>
      <JsonLd data={SERVICE_SCHEMA} />
      <PageHeader
        eyebrow="📞 Page 3 · Trained Listeners & Call Booking"
        slogan="Real ears. Real hearts."
        title="Empathetic human listeners who speak their language."
        description="Our in-house team is trained to just… listen. Book ahead, and we'll match you with someone from the SomeoneNear roster."
      />

      <div className="sn-worker-game-tabs" role="tablist" aria-label="Listener hub sections">
        {[
          ["roster", "👩‍⚕️ ① Choose a Trained Listener"],
          ["scheduled", `📅 ② Upcoming Scheduled Calls (${upcoming.length})`],
          ["reflections", "📝 ③ Post-Call Mood Reflections"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "roster" && (
        <div className="sn-worker-listener-roster">
          {roster.isLoading ? (
            <Skeleton className="h-48" />
          ) : roster.isError ? (
            <p role="alert">
              We couldn’t load the listener roster.{" "}
              <button type="button" onClick={() => void roster.refetch()}>
                Try again
              </button>
            </p>
          ) : roster.data?.length ? (
            roster.data.map((listener) => (
              <article key={listener.id}>
                <div className="sn-family-card-heading">
                  <ListenerAvatar listener={listener} size="lg" />
                  <div>
                    <h2>{listener.name}</h2>
                    <p>{listener.headline}</p>
                  </div>
                </div>
                <p>{listener.bio}</p>
                <div className="sn-worker-focus-tags">
                  {listener.focus_areas?.map((area) => (
                    <span key={area} className="sn-worker-status">
                      {area}
                    </span>
                  ))}
                </div>
                <button
                  className="sn-worker-button"
                  type="button"
                  onClick={() => setBookingOpen(true)}
                >
                  📞 Request a listener call
                </button>
              </article>
            ))
          ) : (
            <p>No listeners are currently listed. You can still review your existing sessions.</p>
          )}
        </div>
      )}

      {section === "reflections" && !feedbackPrompt.data && (
        <section className="sn-worker-detail">
          <h2>Your post-call reflections</h2>
          <p>A reflection prompt will appear here after an eligible completed call.</p>
        </section>
      )}
      {section === "reflections" && feedbackPrompt.data && (
        <div className="mb-6">
          <PostCallFeedbackCard
            bookingId={feedbackPrompt.data.id}
            listenerName={feedbackPrompt.data.listeners?.name ?? "your listener"}
            onDone={() => qc.invalidateQueries({ queryKey: ["session-feedback-prompt"] })}
          />
        </div>
      )}

      {/* SLA + Rules strip */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sn-worker-dialog sn-worker-booking-dialog">
          <DialogTitle>Book a Listener Call</DialogTitle>
          <DialogDescription>
            Choose your preferred time and review the call details.
          </DialogDescription>
          <div
            hidden={section !== "roster" || !bookingOpen}
            className="mb-6 grid gap-3 sm:grid-cols-3"
          >
            <RuleTile
              icon={AlarmIcon}
              title="Scheduled in advance"
              body="Choose a preferred day & time in your timezone. Sessions run 30-60 minutes."
              delay={1}
            />
            <RuleTile
              icon={ShieldCheckIcon}
              title="In-house team, SLA-backed"
              body="Every booking is picked up by a SomeoneNear Listener. Confirmed within 15 minutes."
              delay={2}
            />
            <RuleTile
              icon={CalendarDotIcon}
              title="2-hour reschedule rule"
              body="Reschedule up to 2 hours before the start. Later than that, the session counts as used."
              delay={3}
            />
          </div>

          <div
            hidden={section !== "roster" || !bookingOpen}
            className="grid gap-6 lg:grid-cols-[1.15fr_1fr]"
          >
            {/* Booking form */}
            <Card data-page-reveal className="rounded-brand border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <HandHeartIcon className="h-4 w-4 text-brand-accent" />
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
                      min={todayIso()}
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Session length</Label>
                    <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    placeholder="A word or two about how you're feeling, helps your Listener meet you where you are."
                  />
                </div>
                {bookingError && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-brand border border-destructive/30 bg-destructive/10 p-3">
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {bookingError.message}
                    </p>
                    {bookingError.settingsLink && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/settings">Open Settings</Link>
                      </Button>
                    )}
                  </div>
                )}
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
                  disabled={book.isPending || !capabilities.outboundCallBooking}
                  className="sn-worker-button w-full"
                >
                  {book.isPending ? (
                    <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <EarIcon className="mr-2 h-4 w-4" />
                  )}
                  Book with the in-house team
                </Button>
                {!capabilities.outboundCallBooking && (
                  <p role="status" className="text-sm text-muted-foreground">
                    New call requests are not available yet. You can review your existing sessions
                    in Upcoming Scheduled Calls.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  You'll be matched with a SomeoneNear Listener automatically. No profile picking
                  required.
                </p>
              </CardContent>
            </Card>

            {/* Emergency callback */}
            <Card
              data-page-reveal
              className="rounded-brand border-2 border-primary/30 bg-primary/5"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <PhoneCallIcon className="h-4 w-4 text-brand-accent" />
                  Need someone right now?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-2 text-sm text-foreground">
                  <FlowStep n={1} text="Tap 'Request callback' below." />
                  <FlowStep n={2} text="Our in-house Listener picks it up (SLA: 10 minutes)." />
                  <FlowStep n={3} text="You'll get a call notification, join when you're ready." />
                </ol>
                <div className="rounded-brand border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  If you're in danger, please call your local emergency line first.{" "}
                  <Link to="/safety" className="underline underline-offset-4 hover:opacity-80">
                    Safety resources →
                  </Link>
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
                            preferred_day: todayIso(),
                            preferred_time: "12:00",
                            time_zone: tz,
                            duration_minutes: 30,
                            note: emergencyNote,
                            booking_type: "emergency_callback",
                          })
                        }
                        disabled={book.isPending || !capabilities.outboundCallBooking}
                        className="flex-1"
                      >
                        {book.isPending ? (
                          <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneCallIcon className="mr-2 h-4 w-4" />
                        )}
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
                  <Button onClick={() => setEmergencyOpen(true)} className="w-full">
                    <PhoneCallIcon className="mr-2 h-4 w-4" />
                    Request an emergency callback
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bookings */}
        </DialogContent>
      </Dialog>
      <div hidden={section !== "scheduled"} className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Your sessions</h2>
        {bookings.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-brand" />
            <Skeleton className="h-24 w-full rounded-brand" />
          </div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <EmptyState
            icon={<CalendarDotIcon className="h-6 w-6" />}
            title="Nothing on the calendar yet"
            description="Book your first session above. Our in-house Listener team takes it from there."
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
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
    <div className="rounded-brand border border-border bg-card p-4">
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
  const [tz, setTz] = useState(booking.note?.match(/\[TZ:([^\]]+)\]/)?.[1] ?? DEFAULT_TZ);

  return (
    <div className={`p-4 ${past ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            <span className="inline-flex items-center gap-1.5 rounded-brand border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground">
              <PhoneIcon className="h-3.5 w-3.5 text-brand-accent" />
              Your listener will call your phone at this time
            </span>

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
                <XIcon className="mr-1 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        )}
        {editing && !past && (
          <div className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3 animate-fade-in">
            <Input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-40"
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-32"
            />
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
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
      </div>
    </div>
  );
}
