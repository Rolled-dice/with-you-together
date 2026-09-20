import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CheckInVisual,
  CompanionVisual,
  InsightsVisual,
  RemindersVisual,
  SendLaterVisual,
  UpdateVisual,
  checkInAmbient,
  companionAmbient,
  insightsAmbient,
  remindersAmbient,
  sendLaterAmbient,
  updateAmbient,
  type AmbientBuilder,
} from "./feature-visuals";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

type Slide = {
  id: string;
  tab: string;
  title: string;
  body: string;
  /** Plate fill + the type colour that stays AA-legible on it. */
  plate: string;
  ink: string;
  Visual: () => React.ReactElement;
  /** Looping timeline, created only while this slide is the active one. */
  ambient: AmbientBuilder;
};

/**
 * Order is deliberate, not arbitrary:
 *   1-2  the spine — we call them, then you find out how they are. These two
 *        are one cause-and-effect beat and must stay adjacent and first.
 *   3-4  the between-times — the most concrete daily worry (tablets) before
 *        the softer one (late-night company).
 *   5    what accumulates over time.
 *   6    the emotional close. The carousel loops, so ending on feeling and
 *        restarting on the practical spine is a good cycle.
 */
const SLIDES: Slide[] = [
  {
    id: "check-in",
    tab: "Check-in calls",
    title: "A real person rings them",
    body: "A trained listener calls on their ordinary phone and asks how the day actually went — whether they've eaten, had water, taken their tablets. No script read at them, no robocall, nothing for them to install.",
    plate: "bg-plate-saffron",
    ink: "text-ink",
    Visual: CheckInVisual,
    ambient: checkInAmbient,
  },
  {
    id: "updates",
    tab: "Family updates",
    title: "Then you finally know",
    body: "Minutes after the call, a short written update lands on your dashboard: how they sounded, what they managed, and anything worth a follow-up. Shared with whoever you've added — never a transcript.",
    plate: "bg-plate-pink",
    ink: "text-ink",
    Visual: UpdateVisual,
    ambient: updateAmbient,
  },
  {
    id: "reminders",
    tab: "Reminders",
    title: "Tablets, without the nagging",
    body: "Dose nudges arrive over WhatsApp, so there's no new app to learn. They reply TAKEN or SKIP, we log it, and then we stay quiet. Snap a photo of the prescription and we'll read the schedule off it.",
    plate: "bg-plate-grass",
    ink: "text-background",
    Visual: RemindersVisual,
    ambient: remindersAmbient,
  },
  {
    id: "companion",
    tab: "Companion",
    title: "Someone to talk to at 2am",
    body: "Between calls, an AI companion is there for a daily check-in. One small question, answered in a word or skipped entirely. Private to them, and nothing is ever scored.",
    plate: "bg-plate-violet",
    ink: "text-background",
    Visual: CompanionVisual,
    ambient: companionAmbient,
  },
  {
    id: "insights",
    tab: "Mood trends",
    title: "The shape of a month",
    body: "Every check-in quietly builds a picture over time, so you can see the weeks that were harder instead of guessing. Patterns to notice, not a score to chase.",
    plate: "bg-plate-periwinkle",
    ink: "text-ink",
    Visual: InsightsVisual,
    ambient: insightsAmbient,
  },
  {
    id: "send-later",
    tab: "Send It Later",
    title: "Be there on the day, in advance",
    body: "Write a message now and choose when it should arrive — a birthday, an anniversary, the morning of a hospital appointment. You can't always be there at the right moment, but something of you can.",
    plate: "bg-plate-tangerine",
    ink: "text-ink",
    Visual: SendLaterVisual,
    ambient: sendLaterAmbient,
  },
];

const AUTOPLAY_MS = 6500;

export function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);

  const go = useCallback(
    (next: number) => setActive(((next % SLIDES.length) + SLIDES.length) % SLIDES.length),
    [],
  );

  /* -- Autoplay. Paused on hover, focus, tab-hide and reduced motion. ----- */
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setActive((i) => (i + 1) % SLIDES.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* -- Slide positioning ------------------------------------------------- */
  // Measured from the DOM rather than computed from a fixed slide width, so
  // responsive widths and gaps are handled without duplicating CSS in JS.
  useGSAP(
    () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      const slide = slideRefs.current[active];
      if (!viewport || !track || !slide) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const offset =
        viewport.clientWidth / 2 - (slide.offsetLeft + slide.offsetWidth / 2);

      gsap.to(track, {
        x: offset,
        duration: reduce ? 0 : 0.85,
        ease: "expo.out",
        overwrite: true,
      });

      // Neighbours stay visible but recede, so the active panel reads as the
      // subject rather than one of six equal cards.
      slideRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.to(el, {
          opacity: i === active ? 1 : 0.45,
          scale: i === active ? 1 : 0.94,
          duration: reduce ? 0 : 0.6,
          ease: "power3.out",
          overwrite: "auto",
        });
      });

    },
    { dependencies: [active], scope: rootRef, revertOnUpdate: false },
  );

  /* -- Ambient loop for the active slide only ---------------------------- */
  // Separate hook with revertOnUpdate so switching slides kills the previous
  // loop and restores its inline styles. Exactly one loop runs at a time, and
  // because each visual's initial hidden state is set *inside* its builder,
  // skipping the builder under reduced motion leaves the visual fully visible.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const slide = slideRefs.current[active];
      if (!slide) return;
      SLIDES[active].ambient(slide);
    },
    { dependencies: [active], scope: rootRef, revertOnUpdate: true },
  );

  /* -- Recentre on resize ------------------------------------------------ */
  useEffect(() => {
    const onResize = () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      const slide = slideRefs.current[active];
      if (!viewport || !track || !slide) return;
      gsap.set(track, {
        x: viewport.clientWidth / 2 - (slide.offsetLeft + slide.offsetWidth / 2),
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);

  const current = SLIDES[active];

  return (
    <section id="included" className="scroll-mt-20 py-16">
      <div ref={rootRef}>
        <h2 data-reveal className="px-6 text-center text-2xl sm:text-3xl">
          Everything that comes with it
        </h2>

        {/* Tabs — the fastest way to the thing you actually came for */}
        <div
          data-reveal
          className="mx-auto mt-6 flex w-full max-w-4xl flex-wrap justify-center gap-2 px-6"
        >
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-current={i === active ? "true" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                i === active
                  ? "bg-ink text-background"
                  : "border border-border bg-card text-muted-foreground hover:border-ink/25 hover:text-foreground"
              }`}
            >
              {s.tab}
            </button>
          ))}
        </div>

        {/* Viewport */}
        <div
          ref={viewportRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="What's included with SomeoneNear"
          tabIndex={-1}
          className="relative mt-8 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              go(active + 1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(active - 1);
            }
          }}
        >
          <div ref={trackRef} className="flex w-max items-stretch gap-4 px-4">
            {SLIDES.map((s, i) => {
              const { Visual } = s;
              return (
                <article
                  key={s.id}
                  ref={(el) => {
                    slideRefs.current[i] = el;
                  }}
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${SLIDES.length}: ${s.tab}`}
                  className={`w-[86vw] max-w-[860px] shrink-0 rounded-[32px] px-7 py-10 sm:w-[78vw] sm:px-10 ${s.plate} ${s.ink}`}
                >
                  <div className="grid items-center gap-8 md:grid-cols-2">
                    <div className="order-2 md:order-1">
                      <h3 className="text-2xl sm:text-[1.75rem]">{s.title}</h3>
                      <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed opacity-90">
                        {s.body}
                      </p>
                    </div>
                    <div className="order-1 md:order-2">
                      <Visual />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div
          data-reveal
          className="mt-7 flex items-center justify-center gap-4 px-6"
        >
          <button
            type="button"
            onClick={() => go(active - 1)}
            aria-label="Previous feature"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-ink/25"
          >
            <CaretLeftIcon className="h-4 w-4" weight="bold" />
          </button>

          <div className="flex items-center gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to ${s.tab}`}
                aria-current={i === active ? "true" : undefined}
                className={`h-2 rounded-full transition-all ${
                  i === active ? "w-6 bg-ink" : "w-2 bg-ink/25 hover:bg-ink/40"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(active + 1)}
            aria-label="Next feature"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-ink/25"
          >
            <CaretRightIcon className="h-4 w-4" weight="bold" />
          </button>
        </div>

        {/* Announce the change for screen readers without moving focus. */}
        <p aria-live="polite" className="sr-only">
          {`${current.tab}: ${current.title}`}
        </p>
      </div>
    </section>
  );
}
