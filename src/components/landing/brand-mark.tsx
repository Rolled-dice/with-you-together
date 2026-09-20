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
      viewBox="0 0 64 64"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0", className)}
    >
      {/* Each figure leans 5 degrees inward about its own base. Enough to read
       * as turning toward the other; more and the heads collide. */}
      <g className="text-orb-terracotta" transform="rotate(5 20 58)">
        <circle cx="20" cy="22" r="7" fill="currentColor" />
        <path d="M13 58V38a7 7 0 0 1 14 0v20Z" fill="currentColor" />
      </g>
      <g className="text-orb-navy" transform="rotate(-5 44 58)">
        <circle cx="44" cy="22" r="7" fill="currentColor" />
        <path d="M37 58V38a7 7 0 0 1 14 0v20Z" fill="currentColor" />
      </g>
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
      <BrandMark className="h-9 w-9" />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-orb-navy">Someone</span>
        <span className="text-orb-terracotta">Near</span>
      </span>
    </span>
  );
}
