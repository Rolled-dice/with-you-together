import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { gazeOffset, gazeSupported, subscribeGaze } from "@/lib/orb-gaze";
import { cn } from "@/lib/utils";

/**
 * Character orbs — the Playroom system's one licence for saturated colour.
 *
 * Each orb is a flat circle with a serene, closed-eye face. They stand in for
 * photography and gradients everywhere on the marketing page. Fill comes from
 * `currentColor`, so tone is set with a token text colour class and never a
 * hardcoded hex.
 */

export type OrbTone =
  | "saffron"
  | "pink"
  | "aqua"
  | "grass"
  | "navy"
  | "periwinkle"
  | "terracotta";

export type OrbFace = "calm" | "smile" | "wink" | "plain";

/**
 * Open eyes whose pupils follow the cursor.
 *
 * Kept separate from the closed-eye `Face` variants because tracking needs a
 * visible pupil to move — a contented closed arc has nothing to aim. The whites
 * are the page background rather than pure white so the eyes sit correctly on
 * both light and dark orbs.
 */
function GazingEyes() {
  const pupils = useRef<SVGGElement>(null);

  useEffect(() => {
    const group = pupils.current;
    if (!group || !gazeSupported()) return;

    // quickTo keeps a single interpolating tween per axis instead of spawning a
    // new tween on every pointer frame.
    const xTo = gsap.quickTo(group, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(group, "y", { duration: 0.45, ease: "power3.out" });

    // The orb's box only changes on layout, not on pointer move, so it's cached
    // and refreshed on resize/scroll rather than measured every frame.
    let rect = group.getBoundingClientRect();
    const remeasure = () => {
      rect = group.getBoundingClientRect();
    };

    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, { passive: true });

    const unsubscribe = subscribeGaze((px, py) => {
      const { x, y } = gazeOffset(rect, px, py);
      xTo(x);
      yTo(y);
    });

    return () => {
      unsubscribe();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure);
      gsap.killTweensOf(group);
    };
  }, []);

  return (
    <g>
      <ellipse cx="17.5" cy="21" rx="5.2" ry="5.6" fill="var(--color-background)" />
      <ellipse cx="30.5" cy="21" rx="5.2" ry="5.6" fill="var(--color-background)" />
      <g ref={pupils}>
        <circle cx="17.5" cy="21.4" r="2.7" fill="var(--color-ink)" />
        <circle cx="30.5" cy="21.4" r="2.7" fill="var(--color-ink)" />
      </g>
    </g>
  );
}

const TONE_CLASS: Record<OrbTone, string> = {
  saffron: "text-orb-saffron",
  pink: "text-orb-pink",
  aqua: "text-orb-aqua",
  grass: "text-orb-grass",
  navy: "text-orb-navy",
  periwinkle: "text-orb-periwinkle",
  terracotta: "text-orb-terracotta",
};

/** Faces sit on a 48x48 viewBox so every orb scales from one geometry. */
function Face({ face }: { face: OrbFace }) {
  if (face === "plain") return null;

  // Stroke colour is derived from the orb fill so dark orbs still read.
  const stroke = "var(--color-ink)";
  const common = {
    stroke,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    fill: "none",
  };

  return (
    <g opacity={0.82}>
      {/* Left eye — a downward arc reads as a contented closed eye */}
      <path d="M15 21.5c1.6 2.2 4.4 2.2 6 0" {...common} />
      {/* Right eye, or a flat line for the wink */}
      {face === "wink" ? (
        <path d="M27 22.5h6" {...common} />
      ) : (
        <path d="M27 21.5c1.6 2.2 4.4 2.2 6 0" {...common} />
      )}
      {face === "smile" ? (
        <path d="M19 29.5c2.6 3 7.4 3 10 0" {...common} />
      ) : null}
    </g>
  );
}

export function Orb({
  tone = "saffron",
  face = "calm",
  className,
  size,
  gaze = false,
}: {
  tone?: OrbTone;
  face?: OrbFace;
  className?: string;
  /** Convenience: sets width/height inline when a Tailwind size isn't handy. */
  size?: number;
  /**
   * Open the eyes and follow the cursor. Falls back to the `face` variant on
   * touch devices and when reduced motion is requested, so the orb is never
   * left with blank staring eyes that cannot move.
   */
  gaze?: boolean;
}) {
  // Resolved after mount, never during render: `gazeSupported()` reads `window`
  // and matchMedia, which don't exist during SSR, so deciding at render time
  // would make the server and client markup disagree and trip hydration. The
  // closed-eye face is the SSR output and the honest no-JS fallback.
  const [tracking, setTracking] = useState(false);
  useEffect(() => {
    if (gaze && gazeSupported()) setTracking(true);
  }, [gaze]);

  return (
    <svg
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      className={cn(TONE_CLASS[tone], className)}
    >
      <circle cx="24" cy="24" r="24" fill="currentColor" />
      {tracking ? <GazingEyes /> : <Face face={face} />}
    </svg>
  );
}

/**
 * A squashed orb used as a "cloud" in the footer scene and behind headings.
 * Deliberately faceless — it is scenery, not a character.
 */
export function OrbCloud({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 56"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M20 56c-11 0-20-8.6-20-19.2S9 17.6 20 17.6c1.6 0 3.2.2 4.7.6C28.4 7.4 38.4 0 50.2 0c13.4 0 24.6 9.6 26.6 22.2 1.4-.4 2.9-.6 4.5-.6 10.3 0 18.7 8.1 18.7 18s-8.4 16.4-18.7 16.4H20Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A small four-point sparkle. Used sparingly to punctuate headings. */
export function OrbSparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M12 0c.7 6.2 5.1 10.6 12 12-6.9 1.4-11.3 5.8-12 12-.7-6.2-5.1-10.6-12-12C6.9 10.6 11.3 6.2 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
