import {
  CheckIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  PhoneCallIcon,
  PillIcon,
} from "@phosphor-icons/react";

import { Orb } from "./playroom-orb";

/**
 * One flat visual per carousel feature.
 *
 * Each sits on a saturated plate, so every visual is built on a light card
 * surface rather than inheriting the plate's ink. They explain the feature by
 * showing the actual artefact the user receives — a call screen, an update, a
 * WhatsApp nudge — instead of decorating it with an icon.
 *
 * Elements tagged `data-slide-pop` are animated in by the carousel when their
 * slide becomes active.
 */

function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border-[5px] border-ink bg-card p-3 shadow-soft ${className ?? ""}`}
    >
      <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-ink/15" />
      {children}
    </div>
  );
}

function FloatCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slide-pop
      className={`absolute rounded-2xl border border-ink/10 bg-card px-3 py-2 text-[11px] font-semibold text-foreground shadow-soft ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/* 1 — Check-in calls ------------------------------------------------------- */
export function CheckInVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <Screen className="w-[190px]">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-3 py-5">
          <span className="rounded-full bg-orb-grass/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-orb-grass">
            In call
          </span>
          <Orb tone="periwinkle" face="calm" className="h-16 w-16" />
          <p className="text-xs font-bold">Priya · listener</p>
          <div className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1">
            <PhoneCallIcon className="h-3 w-3 text-background" weight="fill" />
            <span className="text-[10px] font-bold tabular-nums text-background">
              11:42
            </span>
          </div>
        </div>
      </Screen>

      <FloatCard className="-right-2 top-8">
        &ldquo;How was your day, Mum?&rdquo;
      </FloatCard>
      <FloatCard className="-right-1 bottom-10">Rings her landline</FloatCard>
    </div>
  );
}

/* 2 — Family dashboard update --------------------------------------------- */
export function UpdateVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <Screen className="w-[210px]">
        <div className="space-y-2 rounded-2xl bg-surface p-3">
          <div className="flex items-center gap-2">
            <Orb tone="saffron" face="smile" className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-xs font-bold leading-tight">Mum</p>
              <p className="text-[9px] leading-tight text-muted-foreground">
                Today, 11:04 · 14 min
              </p>
            </div>
          </div>
          <p className="text-[10px] font-medium leading-snug">
            &ldquo;Sounded bright. Been out in the garden all morning.&rdquo;
          </p>
          <div className="space-y-1 border-t border-border pt-2">
            {["Ate lunch", "Drank water", "Took her tablets"].map((l) => (
              <p
                key={l}
                className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground"
              >
                <CheckIcon
                  className="h-2.5 w-2.5 text-orb-grass"
                  weight="bold"
                />
                {l}
              </p>
            ))}
          </div>
        </div>
      </Screen>

      <FloatCard className="-right-2 top-6">Mood · steady</FloatCard>
      <FloatCard className="-right-1 bottom-8">Sent to 3 family</FloatCard>
    </div>
  );
}

/* 3 — AI Companion -------------------------------------------------------- */
export function CompanionVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] space-y-2">
      <div
        data-slide-pop
        className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-card px-3.5 py-2.5 text-[11px] font-medium shadow-soft"
      >
        Everyone&apos;s asleep and my head won&apos;t stop.
      </div>

      <div
        data-slide-pop
        className="w-fit max-w-[86%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-soft"
      >
        <span className="mb-1 flex items-center gap-1.5">
          <Orb tone="violet" face="calm" className="h-4 w-4" />
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Companion
          </span>
        </span>
        <span className="block text-[11px] font-medium leading-snug">
          That sounds exhausting. You don&apos;t have to explain it properly —
          what&apos;s the loudest thought right now?
        </span>
      </div>

      <div
        data-slide-pop
        className="ml-auto w-fit rounded-full bg-card px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-soft"
      >
        Answer in a word · or skip
      </div>
    </div>
  );
}

/* 4 — Medication reminders ----------------------------------------------- */
export function RemindersVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div
        data-slide-pop
        className="rounded-2xl bg-card p-3.5 shadow-soft"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orb-grass/15">
            <PillIcon className="h-3.5 w-3.5 text-orb-grass" />
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            WhatsApp
          </span>
        </span>

        <p className="mt-2.5 text-[11.5px] font-medium leading-snug">
          Your evening tablet is due in 20 minutes. Reply{" "}
          <strong>TAKEN</strong> when you&apos;ve had it.
        </p>

        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-ink px-3 py-1 text-[10px] font-bold text-background">
            TAKEN
          </span>
          <span className="rounded-full border border-ink/15 px-3 py-1 text-[10px] font-bold text-muted-foreground">
            SKIP
          </span>
        </div>
      </div>

      <FloatCard className="-right-1 -bottom-4">
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-2.5 w-2.5 text-orb-grass" weight="bold" />
          Logged · 8:12pm
        </span>
      </FloatCard>
    </div>
  );
}

/* 5 — Insights / mood trends -------------------------------------------- */
export function InsightsVisual() {
  // Deliberately uneven — a tidy upward curve would be a dishonest promise.
  const bars = [46, 62, 38, 70, 58, 82, 66];
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div data-slide-pop className="rounded-2xl bg-card p-4 shadow-soft">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          Last 7 days
        </p>

        <div className="mt-3 flex h-24 items-end gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                data-bar
                className="w-full rounded-full bg-orb-periwinkle"
                style={{ height: `${h}%` }}
              />
              <span className="text-[8px] font-bold text-muted-foreground">
                {days[i]}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 border-t border-border pt-2.5 text-[10.5px] font-medium leading-snug text-muted-foreground">
          Quieter midweek, brighter at the weekend when her neighbour visits.
        </p>
      </div>

      <FloatCard className="-right-2 top-2">Patterns, not scores</FloatCard>
    </div>
  );
}

/* 6 — Send It Later ----------------------------------------------------- */
export function SendLaterVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div data-slide-pop className="rounded-2xl bg-card p-4 shadow-soft">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orb-tangerine/20">
            <EnvelopeSimpleIcon className="h-3.5 w-3.5 text-orb-tangerine" />
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Scheduled
          </span>
        </span>

        <p className="mt-2.5 text-[11.5px] font-medium leading-snug">
          &ldquo;Happy birthday, Ma. I&apos;m sorry I can&apos;t be there this
          year — but I&apos;m thinking of you all day.&rdquo;
        </p>

        <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5">
          <ClockIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground">
            Delivers 14 March, 9:00am
          </span>
        </div>
      </div>

      <FloatCard className="-right-2 -top-3">Write it now</FloatCard>
      <FloatCard className="-right-1 -bottom-4">Arrives on the day</FloatCard>
    </div>
  );
}
