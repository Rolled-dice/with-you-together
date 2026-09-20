import gsap from "gsap";
import {
  CheckIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  PhoneCallIcon,
  PillIcon,
} from "@phosphor-icons/react";

import { Orb } from "./playroom-orb";

/**
 * One flat visual per carousel feature, plus the looping "ambient" timeline
 * that brings it to life while its slide is active.
 *
 * Each visual explains the feature by showing the artefact the user actually
 * receives — a call screen, an update, a WhatsApp nudge — and then *performs*
 * the thing happening: the timer runs, the ticks land one by one, the companion
 * types before it replies. That performance is the explanation.
 *
 * Contract with the carousel:
 *   - `data-slide-pop` elements are staggered in when the slide arrives.
 *   - `buildAmbient(root)` returns a looping timeline. The carousel creates it
 *     for the active slide only and kills it on the way out, so exactly one
 *     loop is ever running and offscreen slides cost nothing.
 *   - Ambient timelines are never created under `prefers-reduced-motion`.
 */

export type AmbientBuilder = (root: HTMLElement) => gsap.core.Timeline;

/** Shared helper: scope a query to the slide root. */
const pick = <T extends Element = HTMLElement>(root: HTMLElement, sel: string) =>
  Array.from(root.querySelectorAll<T>(sel));
const one = <T extends Element = HTMLElement>(root: HTMLElement, sel: string) =>
  root.querySelector<T>(sel);

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
  anim,
}: {
  children: React.ReactNode;
  className?: string;
  anim?: string;
}) {
  return (
    <div
      data-slide-pop
      data-anim={anim}
      className={`absolute rounded-2xl border border-ink/10 bg-card px-3 py-2 text-[11px] font-semibold text-foreground shadow-soft ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/* ========================================================================== *
 * 1 — Check-in calls
 * A live call: the ring breathes, the timer actually counts.
 * ========================================================================== */

export function CheckInVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <Screen className="w-[190px]">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-3 py-5">
          <span className="rounded-full bg-orb-grass/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-orb-grass">
            In call
          </span>

          <span className="relative flex h-16 w-16 items-center justify-center">
            {/* Expanding ring — the visual "this is live" signal */}
            <span
              data-anim="ring"
              className="absolute inset-0 rounded-full border-2 border-orb-periwinkle"
            />
            <Orb tone="periwinkle" face="calm" className="h-16 w-16" />
          </span>

          <p className="text-xs font-bold">Priya · listener</p>

          <div className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1">
            <PhoneCallIcon className="h-3 w-3 text-background" weight="fill" />
            <span
              data-anim="timer"
              className="text-[10px] font-bold tabular-nums text-background"
            >
              11:42
            </span>
          </div>
        </div>
      </Screen>

      <FloatCard anim="q1" className="-right-2 top-8">
        &ldquo;How was your day, Mum?&rdquo;
      </FloatCard>
      <FloatCard anim="q2" className="-right-1 bottom-10">
        &ldquo;Did you manage lunch?&rdquo;
      </FloatCard>
    </div>
  );
}

export const checkInAmbient: AmbientBuilder = (root) => {
  const tl = gsap.timeline({ repeat: -1 });
  const ring = one(root, '[data-anim="ring"]');
  const timer = one(root, '[data-anim="timer"]');
  const q1 = one(root, '[data-anim="q1"]');
  const q2 = one(root, '[data-anim="q2"]');

  if (ring) {
    // Own loop so the breathing ring never waits on the question sequence.
    gsap.fromTo(
      ring,
      { scale: 1, opacity: 0.7 },
      {
        scale: 1.45,
        opacity: 0,
        duration: 2,
        ease: "power2.out",
        repeat: -1,
      },
    );
  }

  if (timer) {
    // A real clock, not a static label. Starts where the markup left off so
    // the SSR value isn't a lie.
    const state = { s: 702 }; // 11:42
    gsap.to(state, {
      s: 702 + 60,
      duration: 60,
      ease: "none",
      repeat: -1,
      onUpdate: () => {
        const v = Math.floor(state.s);
        timer.textContent = `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
      },
    });
  }

  // The two prompts trade places, so the card reads as a conversation.
  if (q1 && q2) {
    gsap.set(q2, { autoAlpha: 0, y: 8 });
    tl.to(q1, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" })
      .to({}, { duration: 2.2 })
      .to(q1, { autoAlpha: 0.25, y: -6, duration: 0.45, ease: "power2.inOut" })
      .to(q2, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, "<")
      .to({}, { duration: 2.2 })
      .to(q2, { autoAlpha: 0.25, y: -6, duration: 0.45, ease: "power2.inOut" })
      .to(q1, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, "<");
  }

  return tl;
};

/* ========================================================================== *
 * 2 — Family updates
 * The update arriving: ticks land one at a time, then the mood chip.
 * ========================================================================== */

export function UpdateVisual() {
  const checks = ["Ate lunch", "Drank water", "Took her tablets"];

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <Screen className="w-[210px]">
        <div className="space-y-2 rounded-2xl bg-surface p-3">
          <div className="flex items-center gap-2">
            <Orb
              tone="saffron"
              face="smile"
              className="h-8 w-8 shrink-0"
            />
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
            {checks.map((l) => (
              <p
                key={l}
                data-anim="tick"
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

      <FloatCard anim="mood" className="-right-2 top-6">
        Mood · steady
      </FloatCard>
      <FloatCard anim="sent" className="-right-1 bottom-8">
        Sent to 3 family
      </FloatCard>
    </div>
  );
}

export const updateAmbient: AmbientBuilder = (root) => {
  const ticks = pick(root, '[data-anim="tick"]');
  const mood = one(root, '[data-anim="mood"]');
  const sent = one(root, '[data-anim="sent"]');

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.8 });

  gsap.set([ticks, mood, sent].flat().filter(Boolean), { autoAlpha: 0 });

  tl.to(ticks, {
    autoAlpha: 1,
    x: 0,
    duration: 0.4,
    ease: "power2.out",
    stagger: 0.45,
    startAt: { x: -6 },
  })
    .to(mood, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", startAt: { y: 8 } }, "-=0.2")
    .to(sent, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", startAt: { y: 8 } }, "-=0.15")
    .to({}, { duration: 2.4 })
    .to([ticks, mood, sent].flat().filter(Boolean), {
      autoAlpha: 0,
      duration: 0.45,
      ease: "power2.in",
    });

  return tl;
};

/* ========================================================================== *
 * 3 — Reminders
 * The nudge, the reply, the log. Shown as it happens.
 * ========================================================================== */

export function RemindersVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div className="rounded-2xl bg-card p-3.5 shadow-soft">
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
          <span
            data-anim="taken"
            className="rounded-full bg-ink px-3 py-1 text-[10px] font-bold text-background"
          >
            TAKEN
          </span>
          <span className="rounded-full border border-ink/15 px-3 py-1 text-[10px] font-bold text-muted-foreground">
            SKIP
          </span>
        </div>
      </div>

      <FloatCard anim="logged" className="-right-1 -bottom-4">
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-2.5 w-2.5 text-orb-grass" weight="bold" />
          Logged · 8:12pm
        </span>
      </FloatCard>
    </div>
  );
}

export const remindersAmbient: AmbientBuilder = (root) => {
  const taken = one(root, '[data-anim="taken"]');
  const logged = one(root, '[data-anim="logged"]');

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
  gsap.set(logged, { autoAlpha: 0 });

  tl.to({}, { duration: 1.1 })
    // A press, not a bounce — it should feel like a thumb, not a toy.
    .to(taken, { scale: 0.92, duration: 0.14, ease: "power2.in" })
    .to(taken, { scale: 1, duration: 0.3, ease: "power2.out" })
    .to(
      logged,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
        startAt: { y: 10 },
      },
      "-=0.1",
    )
    .to({}, { duration: 2.4 })
    .to(logged, { autoAlpha: 0, duration: 0.4, ease: "power2.in" });

  return tl;
};

/* ========================================================================== *
 * 4 — Companion
 * It types before it answers, which is the whole point of the feature.
 * ========================================================================== */

export function CompanionVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] space-y-2">
      <div
        data-anim="ask"
        className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-card px-3.5 py-2.5 text-[11px] font-medium shadow-soft"
      >
        Everyone&apos;s asleep and my head won&apos;t stop.
      </div>

      <div
        data-anim="bubble"
        className="w-fit max-w-[86%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-soft"
      >
        <span className="mb-1 flex items-center gap-1.5">
          <Orb tone="violet" face="calm" className="h-4 w-4" />
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Companion
          </span>
        </span>

        {/* Typing indicator, swapped for the reply by the ambient timeline */}
        <span data-anim="typing" className="flex items-center gap-1 py-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              data-anim="dot"
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            />
          ))}
        </span>

        <span
          data-anim="reply"
          className="block text-[11px] font-medium leading-snug"
        >
          That sounds exhausting. You don&apos;t have to explain it properly —
          what&apos;s the loudest thought right now?
        </span>
      </div>

      <div
        data-anim="hint"
        className="ml-auto w-fit rounded-full bg-card px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-soft"
      >
        Answer in a word · or skip
      </div>
    </div>
  );
}

export const companionAmbient: AmbientBuilder = (root) => {
  const ask = one(root, '[data-anim="ask"]');
  const typing = one(root, '[data-anim="typing"]');
  const dots = pick(root, '[data-anim="dot"]');
  const reply = one(root, '[data-anim="reply"]');
  const hint = one(root, '[data-anim="hint"]');

  // Dots run on their own loop for as long as the typing state is shown.
  if (dots.length) {
    gsap.to(dots, {
      y: -3,
      duration: 0.34,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      stagger: 0.12,
    });
  }

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4 });

  gsap.set([ask, hint].filter(Boolean), { autoAlpha: 0 });
  gsap.set(typing, { autoAlpha: 0, display: "flex" });
  gsap.set(reply, { autoAlpha: 0, display: "none" });

  tl.to(ask, {
    autoAlpha: 1,
    y: 0,
    duration: 0.45,
    ease: "power3.out",
    startAt: { y: 10 },
  })
    .to(typing, { autoAlpha: 1, duration: 0.3 }, "+=0.35")
    .to({}, { duration: 1.5 }) // thinking
    .set(typing, { autoAlpha: 0, display: "none" })
    .set(reply, { display: "block" })
    .to(reply, { autoAlpha: 1, duration: 0.45, ease: "power2.out" })
    .to(
      hint,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
        startAt: { y: 8 },
      },
      "+=0.3",
    )
    .to({}, { duration: 2.6 })
    .to([ask, reply, hint].filter(Boolean), {
      autoAlpha: 0,
      duration: 0.4,
      ease: "power2.in",
    })
    .set(reply, { display: "none" })
    .set(typing, { display: "flex" });

  return tl;
};

/* ========================================================================== *
 * 5 — Mood trends
 * Bars draw in as a wave, then breathe. Never re-randomised: inventing new
 * data on a loop would imply a precision this feature doesn't claim.
 * ========================================================================== */

export function InsightsVisual() {
  const bars = [46, 62, 38, 70, 58, 82, 66];
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
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

        <p
          data-anim="read"
          className="mt-3 border-t border-border pt-2.5 text-[10.5px] font-medium leading-snug text-muted-foreground"
        >
          Quieter midweek, brighter at the weekend when her neighbour visits.
        </p>
      </div>

      <FloatCard anim="note" className="-right-2 top-2">
        Patterns, not scores
      </FloatCard>
    </div>
  );
}

export const insightsAmbient: AmbientBuilder = (root) => {
  const bars = pick(root, "[data-bar]");
  const read = one(root, '[data-anim="read"]');
  const note = one(root, '[data-anim="note"]');

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.2 });

  gsap.set(bars, { transformOrigin: "bottom center" });
  gsap.set([read, note].filter(Boolean), { autoAlpha: 0 });

  tl.fromTo(
    bars,
    { scaleY: 0 },
    { scaleY: 1, duration: 0.55, ease: "power3.out", stagger: 0.07 },
  )
    .to(read, { autoAlpha: 1, duration: 0.45, ease: "power2.out" }, "-=0.2")
    .to(note, { autoAlpha: 1, duration: 0.4, ease: "power2.out" }, "-=0.25")
    // A gentle left-to-right breath, so the chart stays alive while it's read.
    .to(bars, {
      scaleY: 1.06,
      duration: 0.5,
      ease: "sine.inOut",
      stagger: { each: 0.08, yoyo: true, repeat: 1 },
    })
    .to({}, { duration: 1.6 })
    .to([bars, read, note].flat().filter(Boolean), {
      autoAlpha: 0,
      duration: 0.4,
      ease: "power2.in",
    });

  return tl;
};

/* ========================================================================== *
 * 6 — Send It Later
 * Written now, delivered later. The loop performs that gap.
 * ========================================================================== */

export function SendLaterVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div data-anim="letter" className="rounded-2xl bg-card p-4 shadow-soft">
        <span className="flex items-center gap-2">
          <span
            data-anim="seal"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-orb-tangerine/20"
          >
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
          <ClockIcon
            data-anim="clock"
            className="h-3 w-3 text-muted-foreground"
          />
          <span className="text-[10px] font-bold text-muted-foreground">
            Delivers 14 March, 9:00am
          </span>
        </div>
      </div>

      {/* The journey the message takes, stated as two moments */}
      <FloatCard anim="now" className="-right-2 -top-3">
        Write it today
      </FloatCard>
      <FloatCard anim="later" className="-right-1 -bottom-4">
        Arrives on the day
      </FloatCard>
    </div>
  );
}

export const sendLaterAmbient: AmbientBuilder = (root) => {
  const letter = one(root, '[data-anim="letter"]');
  const seal = one(root, '[data-anim="seal"]');
  const clock = one(root, '[data-anim="clock"]');
  const now = one(root, '[data-anim="now"]');
  const later = one(root, '[data-anim="later"]');

  // The clock turns continuously — time passing is the feature.
  if (clock) {
    gsap.to(clock, { rotate: 360, duration: 12, ease: "none", repeat: -1 });
  }
  if (seal) {
    gsap.to(seal, {
      scale: 1.08,
      duration: 1.8,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  }

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
  gsap.set([now, later].filter(Boolean), { autoAlpha: 0 });

  tl.to(now, {
    autoAlpha: 1,
    y: 0,
    duration: 0.45,
    ease: "power3.out",
    startAt: { y: 10 },
  })
    .to({}, { duration: 1.6 })
    // The card lifts as the message "leaves", then the later moment lands.
    .to(letter, { y: -8, duration: 0.6, ease: "power2.inOut" })
    .to(now, { autoAlpha: 0.2, duration: 0.5, ease: "power2.inOut" }, "<")
    .to(
      later,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        startAt: { y: 12 },
      },
      "-=0.25",
    )
    .to({}, { duration: 2.2 })
    .to(letter, { y: 0, duration: 0.6, ease: "power2.inOut" })
    .to([now, later].filter(Boolean), {
      autoAlpha: 0,
      duration: 0.4,
      ease: "power2.in",
    }, "<");

  return tl;
};
