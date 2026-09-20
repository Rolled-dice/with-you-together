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
 * receives — a call screen, an update, a calendar alert — and then *performs*
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
      // `text-foreground` is load-bearing: the dark plates (violet, grass) set
      // a near-white ink on the whole slide, which would otherwise cascade into
      // this light card and render every unstyled label invisible.
      className={`rounded-3xl border-[5px] border-ink bg-card p-3 text-foreground shadow-soft ${className ?? ""}`}
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
      <Screen className="w-[212px]">
        {/* Lock screen, so the notification reads as arriving on their phone */}
        <div className="relative h-[228px] overflow-hidden rounded-2xl bg-surface p-2.5">
          <div className="flex items-center justify-between px-0.5 text-[8px] font-bold text-muted-foreground">
            <span>Tue 12 Nov</span>
            <span className="tabular-nums">7:58</span>
          </div>
          <p className="mt-2 text-center text-3xl font-extrabold tabular-nums tracking-tight">
            7:58
          </p>

          {/* The notification itself — slides down from the top of the screen */}
          <div
            data-anim="notif"
            className="relative mt-4 rounded-xl border border-ink/10 bg-card p-2.5 shadow-soft"
          >
            <span className="flex items-center gap-1.5">
              {/* Calendar glyph: a real date tile, not a generic bell */}
              <span className="flex h-4 w-4 flex-col overflow-hidden rounded-[3px] border border-ink/15 bg-card">
                <span className="h-1 w-full bg-orb-aqua" />
                <span className="flex flex-1 items-center justify-center text-[5px] font-extrabold leading-none">
                  12
                </span>
              </span>
              <span className="text-[7.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Calendar · now
              </span>
            </span>

            <p className="mt-1.5 text-[10px] font-bold leading-tight">
              Evening tablet
            </p>
            <p className="text-[8.5px] leading-tight text-muted-foreground">
              8:00 pm · Metformin 500mg
            </p>

            <div className="mt-2 flex gap-1.5">
              {/* Two stacked states: the highlight sits on top at opacity 0 and
               * is revealed on acknowledgement, so no colour is animated. */}
              <span className="relative overflow-hidden rounded-full">
                <span className="block rounded-full border border-ink/15 px-2.5 py-1 text-[8px] font-extrabold text-muted-foreground">
                  Taken
                </span>
                <span
                  data-anim="hl"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-orb-grass px-2.5 text-[8px] font-extrabold text-background"
                >
                  Taken
                </span>
              </span>
              <span className="rounded-full border border-ink/15 px-2.5 py-1 text-[8px] font-extrabold text-muted-foreground">
                Snooze
              </span>
            </div>
          </div>

          {/* Confirmation replaces the prompt once acknowledged */}
          <div
            data-anim="done"
            className="mt-2 flex items-center gap-1.5 rounded-xl bg-orb-grass/12 px-2.5 py-2"
          >
            <CheckIcon className="h-2.5 w-2.5 text-orb-grass" weight="bold" />
            <span className="text-[8.5px] font-bold text-orb-grass">
              Logged · the family can see it
            </span>
          </div>
        </div>
      </Screen>

      <FloatCard anim="pill" className="-right-2 top-10">
        <span className="flex items-center gap-1.5">
          <PillIcon className="h-3 w-3 text-orb-grass" />
          One tap, no typing
        </span>
      </FloatCard>
    </div>
  );
}

export const remindersAmbient: AmbientBuilder = (root) => {
  const notif = one(root, '[data-anim="notif"]');
  const hl = one(root, '[data-anim="hl"]');
  const done = one(root, '[data-anim="done"]');
  const pill = one(root, '[data-anim="pill"]');

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4 });

  gsap.set([done, pill].filter(Boolean), { autoAlpha: 0 });
  gsap.set(hl, { autoAlpha: 0 });

  tl
    // 1. The notification drops in from above the screen edge.
    .fromTo(
      notif,
      { autoAlpha: 0, y: -46 },
      { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" },
    )
    .to(
      pill,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
        startAt: { y: 8 },
      },
      "-=0.2",
    )
    .to({}, { duration: 1.3 })
    // 2. Acknowledged. A press, then the highlight sweeps over the label —
    //    revealing a second layer rather than animating a colour value.
    .to(notif, { scale: 0.985, duration: 0.14, ease: "power2.in" })
    .to(notif, { scale: 1, duration: 0.3, ease: "power2.out" })
    .to(hl, { autoAlpha: 1, duration: 0.32, ease: "power2.out" }, "-=0.24")
    // 3. The log lands, which is the bit the family actually cares about.
    .to(
      done,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
        startAt: { y: 10 },
      },
      "+=0.25",
    )
    .to({}, { duration: 2.3 })
    .to([notif, done, pill].filter(Boolean), {
      autoAlpha: 0,
      duration: 0.42,
      ease: "power2.in",
    })
    .set(hl, { autoAlpha: 0 });

  return tl;
};

/* ========================================================================== *
 * 4 — Companion
 * It types before it answers, which is the whole point of the feature.
 * ========================================================================== */

/** One exchange in the thread. AI turns carry a typing state. */
const CHAT: { from: "you" | "ai"; text: string }[] = [
  { from: "you", text: "can't sleep again" },
  { from: "ai", text: "Me neither. Well — I don't, technically. Want company?" },
  { from: "you", text: "yeah" },
  { from: "ai", text: "Then I'll just sit here. No advice, promise." },
];

export function CompanionVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <Screen className="w-[228px]">
        {/* Header makes it unmistakably a chat, and with whom */}
        <div className="flex items-center gap-2 border-b border-border px-1 pb-2">
          <Orb tone="violet" face="smile" className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold leading-tight">Companion</p>
            <p className="flex items-center gap-1 text-[7.5px] leading-tight text-orb-grass">
              <span className="h-1 w-1 rounded-full bg-orb-grass" />
              Always awake
            </p>
          </div>
          {/* The 2am claim, shown rather than asserted in prose */}
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[7.5px] font-extrabold tabular-nums text-muted-foreground">
            2:14 AM
          </span>
        </div>

        <div className="space-y-1.5 px-1 pt-2.5">
          {CHAT.map((m, i) =>
            m.from === "you" ? (
              <div
                key={i}
                data-msg
                className="ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-sm bg-ink px-2.5 py-1.5 text-[9.5px] font-medium text-background"
              >
                {m.text}
              </div>
            ) : (
              <div
                key={i}
                data-msg
                data-from="ai"
                className="w-fit max-w-[88%] rounded-2xl rounded-bl-sm bg-surface px-2.5 py-1.5"
              >
                {/* Typing dots, swapped for the text by the ambient timeline */}
                <span data-typing className="flex items-center gap-1 py-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      data-dot
                      className="h-1 w-1 rounded-full bg-muted-foreground"
                    />
                  ))}
                </span>
                <span
                  data-text
                  className="block text-[9.5px] font-medium leading-snug"
                >
                  {m.text}
                </span>
              </div>
            ),
          )}
        </div>
      </Screen>
      {/* No float card here on purpose: the thread is the whole story, and the
       * "answer in a word" hint already lives in the slide's body copy. */}
    </div>
  );
}

export const companionAmbient: AmbientBuilder = (root) => {
  const msgs = pick(root, "[data-msg]");
  const dots = pick(root, "[data-dot]");
  const note = one(root, '[data-anim="note"]');

  // Dots bounce on their own loop, independent of the conversation's pacing.
  if (dots.length) {
    gsap.to(dots, {
      y: -2.5,
      duration: 0.32,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      stagger: 0.11,
    });
  }

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });

  // Reset: nothing sent yet, and every AI bubble starts in its typing state.
  gsap.set([msgs, note].flat().filter(Boolean), { autoAlpha: 0 });
  msgs.forEach((m) => {
    if (m.dataset.from !== "ai") return;
    gsap.set(m.querySelector("[data-typing]"), { display: "flex" });
    gsap.set(m.querySelector("[data-text]"), { display: "none", autoAlpha: 0 });
  });

  // Play the thread turn by turn. AI turns think first, then answer — the
  // pause is the point, so it reads as a reply rather than a canned string.
  msgs.forEach((m) => {
    const isAi = m.dataset.from === "ai";

    tl.to(m, {
      autoAlpha: 1,
      y: 0,
      duration: 0.38,
      ease: "power3.out",
      startAt: { y: 8 },
    });

    if (!isAi) {
      tl.to({}, { duration: 0.3 });
      return;
    }

    const typing = m.querySelector("[data-typing]");
    const text = m.querySelector("[data-text]");

    tl.to({}, { duration: 0.85 }) // thinking
      .set(typing, { display: "none" })
      .set(text, { display: "block" })
      .to(text, { autoAlpha: 1, duration: 0.34, ease: "power2.out" })
      .to({}, { duration: 0.35 });
  });

  // `note` is optional — guard rather than handing GSAP a null target.
  if (note) {
    tl.to(
      note,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
        startAt: { y: 8 },
      },
      "-=0.3",
    );
  }

  tl.to({}, { duration: 1.2 }).to([msgs, note].flat().filter(Boolean), {
    autoAlpha: 0,
    duration: 0.4,
    ease: "power2.in",
  });

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
      {/* text-foreground so a dark plate's ink can't cascade in — see Screen */}
      <div className="rounded-2xl bg-card p-4 text-foreground shadow-soft">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          Last 7 days
        </p>

        <div className="mt-3 flex items-end gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              {/* The track carries a definite height so the bar's percentage
               * has something to resolve against. Without it the bar collapses
               * to 0px and the whole chart is invisible. */}
              <div className="flex h-24 w-full items-end">
                <div
                  data-bar
                  className="w-full rounded-full bg-orb-periwinkle"
                  style={{ height: `${h}%` }}
                />
              </div>
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

  // autoAlpha is restored here, not just scaleY. The cycle ends by fading the
  // bars out, so resetting only the scale would leave them invisible from the
  // second loop onward.
  tl.fromTo(
    bars,
    { scaleY: 0, autoAlpha: 1 },
    { scaleY: 1, autoAlpha: 1, duration: 0.55, ease: "power3.out", stagger: 0.07 },
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
      <div
        data-anim="letter"
        className="rounded-2xl bg-card p-4 text-foreground shadow-soft"
      >
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
