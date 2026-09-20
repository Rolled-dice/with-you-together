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
  | "violet"
  | "periwinkle"
  | "tangerine";

export type OrbFace = "calm" | "smile" | "wink" | "plain";

const TONE_CLASS: Record<OrbTone, string> = {
  saffron: "text-orb-saffron",
  pink: "text-orb-pink",
  aqua: "text-orb-aqua",
  grass: "text-orb-grass",
  violet: "text-orb-violet",
  periwinkle: "text-orb-periwinkle",
  tangerine: "text-orb-tangerine",
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
}: {
  tone?: OrbTone;
  face?: OrbFace;
  className?: string;
  /** Convenience: sets width/height inline when a Tailwind size isn't handy. */
  size?: number;
}) {
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
      <Face face={face} />
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
