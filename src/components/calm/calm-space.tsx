import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
  WindIcon,
  FlowerLotusIcon,
  GameControllerIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatakArcade } from "./chatak-arcade";

/**
 * The Calm space: guided breathing and a no-score "let it float" game.
 *
 * Extracted from the authenticated route so the exact same activity can run on
 * the public landing route (a first visit, no login) and inside the app. The
 * component is deliberately self-contained and client-only (motion + timers),
 * which also keeps it safe on the Cloudflare Worker runtime — nothing here
 * touches Node APIs or server functions.
 *
 * Colour note: every fill is a brand/orb token (navy brand-primary, the orb
 * family for the bubbles), never a near-white grey, so the orb and bubbles read
 * clearly on the warm canvas instead of washing out.
 */

type Mode = "breathe" | "float" | "chatak";

export function CalmSpace() {
  const [mode, setMode] = useState<Mode>("breathe");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      {/* Two quiet activities, one at a time, so each fits on a single screen. */}
      <div
        role="tablist"
        aria-label="Choose an activity"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const modes: Mode[] = ["breathe", "float", "chatak"];
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 2
                : (modes.indexOf(mode) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
          setMode(modes[index]);
          event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']")[index]?.focus();
        }}
        className="mb-5 inline-flex w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1 sm:w-auto"
      >
        {(
          [
            { id: "breathe", label: "Breathe", icon: WindIcon },
            { id: "float", label: "Let it float", icon: FlowerLotusIcon },
            { id: "chatak", label: "Chatak-Patak", icon: GameControllerIcon },
          ] as const
        ).map((t) => {
          const selected = mode === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`calm-tab-${t.id}`}
              aria-controls="calm-activity"
              tabIndex={selected ? 0 : -1}
              disabled={!ready}
              aria-selected={selected}
              onClick={() => setMode(t.id)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors sm:flex-none sm:px-5",
                selected
                  ? "bg-brand-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div id="calm-activity" role="tabpanel" aria-labelledby={`calm-tab-${mode}`}>
        {mode === "breathe" ? <Breathing /> : mode === "float" ? <FloatAway /> : <ChatakArcade />}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Guided breathing                                                           */
/* -------------------------------------------------------------------------- */

type Phase = { label: string; seconds: number; scale: number };
type Pattern = { id: string; name: string; hint: string; phases: Phase[] };

const PATTERNS: Pattern[] = [
  {
    id: "calm",
    name: "Settle",
    hint: "In 4 · out 6",
    phases: [
      { label: "Breathe in", seconds: 4, scale: 1 },
      { label: "Breathe out", seconds: 6, scale: 0.55 },
    ],
  },
  {
    id: "box",
    name: "Box",
    hint: "4 · 4 · 4 · 4",
    phases: [
      { label: "Breathe in", seconds: 4, scale: 1 },
      { label: "Hold", seconds: 4, scale: 1 },
      { label: "Breathe out", seconds: 4, scale: 0.55 },
      { label: "Hold", seconds: 4, scale: 0.55 },
    ],
  },
  {
    id: "478",
    name: "Sleepy",
    hint: "4 · 7 · 8",
    phases: [
      { label: "Breathe in", seconds: 4, scale: 1 },
      { label: "Hold", seconds: 7, scale: 1 },
      { label: "Breathe out", seconds: 8, scale: 0.55 },
    ],
  },
];

// Sine-shaped ease: breath accelerates and slows like real lungs do.
const BREATH_EASE = [0.37, 0, 0.63, 1] as const;

function Breathing() {
  const reduceMotion = useReducedMotion();
  const [patternId, setPatternId] = useState(PATTERNS[0].id);
  const pattern = PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[0];
  const [running, setRunning] = useState(false);
  // One state object, advanced by a pure tick, so StrictMode's double-invoked
  // updaters can't skip a phase.
  const [clock, setClock] = useState({
    phaseIndex: 0,
    secondsLeft: pattern.phases[0].seconds,
    rounds: 0,
  });
  const { phaseIndex, secondsLeft, rounds } = clock;
  const phase = pattern.phases[phaseIndex];

  // Reset when the pattern changes.
  useEffect(() => {
    setRunning(false);
    setClock({ phaseIndex: 0, secondsLeft: pattern.phases[0].seconds, rounds: 0 });
  }, [pattern]);

  // One tick per second drives the countdown and phase changes.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setClock((c) => {
        if (c.secondsLeft > 1) return { ...c, secondsLeft: c.secondsLeft - 1 };
        const next = (c.phaseIndex + 1) % pattern.phases.length;
        return {
          phaseIndex: next,
          secondsLeft: pattern.phases[next].seconds,
          rounds: next === 0 ? c.rounds + 1 : c.rounds,
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, pattern]);

  function reset() {
    setRunning(false);
    setClock({ phaseIndex: 0, secondsLeft: pattern.phases[0].seconds, rounds: 0 });
  }

  const cue = running ? phase.label : rounds > 0 ? "Paused" : "Ready when you are";
  const targetScale = running ? phase.scale : 0.7;

  return (
    <section
      className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-center"
      aria-label="Guided breathing"
    >
      {/* Short on phones so the rhythm picker + Start button stay above the bottom nav.
          The stage uses a periwinkle wash so the navy orb has clear contrast. */}
      <div className="relative flex h-[32dvh] min-h-52 w-full items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-orb-periwinkle/45 via-orb-periwinkle/25 to-plate-cream md:h-auto md:aspect-square md:max-h-[60dvh]">
        {/* Soft halo rings, static — only the orb itself moves. Height-driven + aspect-square keeps them circular. */}
        <div
          aria-hidden
          className="absolute aspect-square h-[92%] rounded-full border border-brand-primary/20"
        />
        <div
          aria-hidden
          className="absolute aspect-square h-[74%] rounded-full border border-brand-primary/20"
        />

        {reduceMotion ? (
          <div
            aria-hidden
            className="flex aspect-square h-[62%] items-center justify-center rounded-full bg-brand-primary transition-opacity duration-700"
            style={{ opacity: running ? (phase.scale === 1 ? 1 : 0.7) : 0.85 }}
          />
        ) : (
          <motion.div
            aria-hidden
            className="aspect-square h-[62%] rounded-full bg-gradient-to-br from-brand-primary to-orb-navy shadow-[0_30px_80px_-24px_rgba(37,67,95,0.65)]"
            animate={{ scale: targetScale }}
            initial={{ scale: 0.7 }}
            transition={{ duration: running ? phase.seconds : 0.8, ease: BREATH_EASE }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center text-primary-foreground">
          <p
            aria-live="polite"
            className="max-w-[8.5rem] text-lg font-bold leading-snug drop-shadow-sm sm:max-w-[11rem] sm:text-2xl"
          >
            {cue}
          </p>
          {running && (
            <p className="mt-1 text-4xl font-extrabold tabular-nums drop-shadow-sm">
              {secondsLeft}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Rhythm</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPatternId(p.id)}
                aria-pressed={p.id === patternId}
                className={cn(
                  "min-h-16 rounded-2xl border px-2 py-2 text-left transition-colors",
                  p.id === patternId
                    ? "border-brand-primary bg-brand-primary/10"
                    : "border-border bg-card hover:border-brand-primary/40",
                )}
              >
                <span className="block text-sm font-bold text-foreground">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="min-h-12 flex-1 rounded-full text-base"
          >
            {running ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            {running ? "Pause" : rounds > 0 ? "Continue" : "Start breathing"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            aria-label="Start over"
            className="min-h-12 rounded-full px-4"
          >
            <ArrowCounterClockwiseIcon className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {rounds === 0
            ? "Follow the circle: let it grow as you breathe in, shrink as you breathe out."
            : `${rounds} ${rounds === 1 ? "round" : "rounds"} done. That's a real pause for your body.`}
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Let it float — a no-score bubble game                                      */
/* -------------------------------------------------------------------------- */

type Bubble = {
  id: number;
  x: number; // % from left
  size: number; // px
  duration: number; // seconds to rise
  drift: number; // px sideways sway
  top: number; // % from top — only used when motion is reduced (bubbles stay put)
  tone: string; // orb tint class
  word?: string;
};

const SOFT_WORDS = ["breathe", "rest", "enough", "soft", "here", "okay", "slow", "gentle"];

// Visible, friendly tints from the orb family — each bubble gets one so they
// read as coloured glass rather than the near-invisible white blobs before.
const BUBBLE_TONES = [
  "from-orb-periwinkle/70 to-orb-periwinkle/30 border-orb-periwinkle/60",
  "from-orb-pink/70 to-orb-pink/30 border-orb-pink/60",
  "from-orb-aqua/70 to-orb-aqua/30 border-orb-aqua/60",
  "from-orb-saffron/70 to-orb-saffron/30 border-orb-saffron/60",
  "from-orb-terracotta/60 to-orb-terracotta/25 border-orb-terracotta/55",
];

function FloatAway() {
  const reduceMotion = useReducedMotion();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [released, setReleased] = useState(0);
  const [worry, setWorry] = useState("");
  const nextId = useRef(1);

  const spawn = useMemo(
    () => (word?: string) => {
      const id = nextId.current++;
      const size = word ? 104 : 56 + Math.round(Math.random() * 40);
      const bubble: Bubble = {
        id,
        x: 8 + Math.random() * 74,
        size,
        duration: 12 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 60,
        top: 10 + Math.random() * 60,
        tone: BUBBLE_TONES[Math.floor(Math.random() * BUBBLE_TONES.length)],
        word:
          word ??
          (Math.random() < 0.35
            ? SOFT_WORDS[Math.floor(Math.random() * SOFT_WORDS.length)]
            : undefined),
      };
      setBubbles((b) => [...b.slice(-11), bubble]);
    },
    [],
  );

  // A slow, steady trickle of bubbles — never a flood. Slower still when the
  // person has asked for reduced motion, since bubbles then stay in place.
  useEffect(() => {
    spawn();
    const id = window.setInterval(() => spawn(), reduceMotion ? 4000 : 1800);
    return () => window.clearInterval(id);
  }, [spawn, reduceMotion]);

  function pop(id: number) {
    setBubbles((b) => b.filter((x) => x.id !== id));
    setReleased((r) => r + 1);
  }

  function letGo(e: React.FormEvent) {
    e.preventDefault();
    const w = worry.trim();
    if (!w) return;
    spawn(w.slice(0, 24));
    setWorry("");
  }

  return (
    <section className="space-y-4" aria-label="Let it float">
      <div className="relative h-[40dvh] min-h-64 w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-orb-periwinkle/35 via-orb-aqua/10 to-plate-cream">
        <AnimatePresence>
          {bubbles.map((b) => (
            <motion.button
              key={b.id}
              type="button"
              onClick={() => pop(b.id)}
              aria-label={b.word ? `Pop bubble: ${b.word}` : "Pop bubble"}
              className={cn(
                "absolute flex items-center justify-center rounded-full border bg-gradient-to-br px-2 text-center text-xs font-bold text-brand-primary shadow-[inset_0_2px_10px_rgba(255,255,255,0.7),0_8px_24px_-8px_rgba(37,67,95,0.35)] focus-visible:outline-2 focus-visible:outline-brand-primary",
                b.tone,
                !reduceMotion && "bottom-0",
              )}
              style={{
                left: `${b.x}%`,
                width: b.size,
                height: b.size,
                ...(reduceMotion ? { top: `${b.top}%` } : null),
              }}
              initial={reduceMotion ? { opacity: 0 } : { y: "110%", x: 0, opacity: 0 }}
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : {
                      y: "-60dvh",
                      x: [0, b.drift, -b.drift / 2, b.drift / 3],
                      opacity: [0, 1, 1, 0.9],
                    }
              }
              exit={{ scale: 1.35, opacity: 0, transition: { duration: 0.25 } }}
              transition={
                reduceMotion
                  ? { duration: 0.6 }
                  : {
                      duration: b.duration,
                      ease: [0.25, 0.1, 0.25, 1],
                      x: { duration: b.duration, ease: "easeInOut" },
                    }
              }
              onAnimationComplete={() => {
                if (!reduceMotion) setBubbles((all) => all.filter((x) => x.id !== b.id));
              }}
            >
              {b.word}
            </motion.button>
          ))}
        </AnimatePresence>

        <p className="pointer-events-none absolute left-4 top-4 rounded-full bg-brand-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow-sm">
          {released === 0 ? "Tap a bubble to let it go" : `${released} let go`}
        </p>
      </div>

      <form onSubmit={letGo} className="flex gap-2">
        <label htmlFor="calm-worry" className="sr-only">
          Name something on your mind
        </label>
        <Input
          id="calm-worry"
          value={worry}
          maxLength={24}
          onChange={(e) => setWorry(e.target.value)}
          placeholder="Name a worry, then let it float"
          className="min-h-12 flex-1 rounded-full px-5 text-base"
        />
        <Button type="submit" disabled={!worry.trim()} className="min-h-12 rounded-full px-5">
          Let it go
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Nothing you type here is saved.</p>
    </section>
  );
}
