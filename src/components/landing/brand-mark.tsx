import { cn } from "@/lib/utils";

/**
 * The SomeoneNear mark: two figures seated facing one another, terracotta and
 * navy. This is the real artwork, not a recreation.
 *
 * Both supplied exports had their transparency checkerboard flattened into
 * opaque pixels — the first as a 1 MB PNG, the second as a 7 MB base64 raster
 * wrapped in an SVG tag. `scripts/clean-logo.ps1` strips that grid (the
 * checkerboard is pure greyscale, the mark is saturated, so a channel-spread
 * threshold separates them), crops to the content bounds and emits the sizes
 * under `public/`. Re-run it if the artwork changes.
 *
 * The nav deliberately loads `logo-mark.png` (256px, ~38 KB) rather than the
 * 640px `logo.png`, which exists for Open Graph and structured data. At 36px
 * tall, 256px still covers 3x displays.
 *
 * Decorative wherever the wordmark sits beside it — the adjacent text already
 * names the brand, so alt text would just repeat it. Pass `title` when the mark
 * stands alone.
 */

const ASPECT = 256 / 225;

export function BrandMark({
  className,
  title,
}: {
  className?: string;
  /** Provide only when the mark appears without the wordmark beside it. */
  title?: string;
}) {
  return (
    <img
      src="/logo-mark.png"
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={256}
      height={225}
      decoding="async"
      // Eager, not lazy: this sits above the fold in the nav on every route.
      loading="eager"
      className={cn("shrink-0 object-contain", className)}
      style={{ aspectRatio: ASPECT }}
    />
  );
}

/**
 * Mark plus wordmark, as used in the nav and footer.
 *
 * The wordmark is two-tone because the name is two words about two people and
 * the mark is two figures in two colours — the split carries the same idea
 * rather than decorating one word for emphasis.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="h-10 w-auto" />
      <span className="text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">
        <span className="text-brand-primary">Someone</span>
        <span className="text-brand-accent">Near</span>
      </span>
    </span>
  );
}
