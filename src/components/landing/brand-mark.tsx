import { cn } from "@/lib/utils";

/**
 * The SomeoneNear mark: two figures leaning toward one another, not quite
 * touching. Terracotta and navy, straight from the brand pair.
 *
 * Inline SVG rather than a raster asset, for three reasons:
 *   - Genuine transparency. The PNG export had its checkerboard flattened into
 *     real pixels, which rendered as a grey box behind the mark.
 *   - Weight. This is well under a kilobyte against a 1 MB PNG that was being
 *     downscaled to 36px anyway.
 *   - Colour. Fills come from `currentColor` on each group, so the mark tracks
 *     the brand tokens and adapts in dark mode instead of being baked in.
 *
 * This is a faithful recreation, not the designer's exact artwork. If the
 * original is exported as a transparent SVG, replace the two groups below with
 * its paths and everything else here still holds.
 */

export function BrandMark({
  className,
  title,
}: {
  className?: string;
  /** Provide only when the mark appears without the wordmark beside it. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 112 72"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0", className)}
    >
      {/* Each figure is one stroked path: up the back, over the shoulder, down
       * the torso, then out along the knee. Stroked rather than filled because
       * the original has an even ribbon weight throughout. The two knees stop
       * just short of touching — that gap is the whole idea of the name. */}
      <g
        fill="none"
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          className="text-orb-terracotta"
          stroke="currentColor"
          d="M12 60V38q0-12 12-12t11 12v6q0 10 13 10"
        />
        <path
          className="text-orb-navy"
          stroke="currentColor"
          d="M100 60V38q0-12-12-12t-11 12v6q0 10-13 10"
        />
      </g>
      <circle
        className="text-orb-terracotta"
        cx="26"
        cy="12"
        r="8.5"
        fill="currentColor"
      />
      <circle
        className="text-orb-navy"
        cx="86"
        cy="12"
        r="8.5"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark, as used in the nav and footer.
 *
 * The wordmark is two-tone because the name is literally two words describing
 * two people, and the mark is two figures in two colours — so the split
 * carries the same idea rather than decorating one word for emphasis.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* 112x72 viewBox, so the box must be ~1.56:1 or the figures squash */}
      <BrandMark className="h-9 w-14" />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-orb-navy">Someone</span>
        <span className="text-orb-terracotta">Near</span>
      </span>
    </span>
  );
}
