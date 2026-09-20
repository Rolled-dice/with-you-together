import { cn } from "@/lib/utils";

/**
 * The SomeoneNear mark: two figures sitting facing each other, one leaning in.
 *
 * Served as a static asset rather than inlined SVG so the artwork stays the
 * designer's file and never drifts from a hand-maintained copy of the paths.
 * Drop the export at `public/logo.png` (or swap `SRC` for an `.svg`).
 *
 * The mark is decorative wherever it sits beside the wordmark — the adjacent
 * text already names the brand, so repeating it in alt text is noise for
 * screen-reader users. Pass `title` only when the mark stands alone.
 */

const SRC = "/logo.png";

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
      src={SRC}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={32}
      height={32}
      decoding="async"
      className={cn("h-7 w-7 shrink-0 object-contain", className)}
    />
  );
}

/** Mark plus wordmark, as used in the nav and footer. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-lg font-extrabold tracking-tight">SomeoneNear</span>
    </span>
  );
}
