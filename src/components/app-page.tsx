import type { ReactNode } from "react";

import { Orb, type OrbTone } from "@/components/landing/playroom-orb";
import { cn } from "@/lib/utils";

/**
 * Shared page furniture for authenticated screens.
 *
 * Exists so every in-app page opens the same way instead of each one inventing
 * its own header. Pairs with `useAppPageMotion`, which drives the entrance off
 * the `data-page-*` attributes set here.
 *
 * House rules baked in, both aimed at members who are often elderly:
 *   - Warm cream plate, never a saturated fill. Colour appears once, as a
 *     single orb.
 *   - 17px supporting copy at full `muted-foreground`, never reduced opacity.
 *     Small text at 60% opacity is a common readability failure with age.
 */
export function AppHero({
  eyebrow,
  title,
  description,
  orb = "saffron",
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** The single spot of colour on the page. */
  orb?: OrbTone;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-border bg-surface px-6 py-8 sm:px-9 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 hidden sm:block"
      >
        {/* Follows the cursor. One friendly detail per screen. */}
        <Orb tone={orb} face="smile" gaze className="h-32 w-32 opacity-80" />
      </div>

      <div className="relative max-w-2xl">
        {eyebrow && (
          <p
            data-page-eyebrow
            className="text-sm font-bold text-orb-terracotta"
          >
            {eyebrow}
          </p>
        )}

        <h1
          data-page-headline
          className={cn(
            "text-[1.75rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2.2rem]",
            eyebrow && "mt-1.5",
          )}
        >
          {title}
        </h1>

        {description && (
          <p
            data-page-sub
            className="mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground"
          >
            {description}
          </p>
        )}

        {actions && (
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {actions}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

/**
 * Section title. Sentence case at 20px rather than tracked-out 11px caps —
 * small caps strip the word-shape cues readers rely on, which matters most for
 * exactly the people using this app.
 */
export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {action ??
        (hint && (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {hint}
          </span>
        ))}
    </div>
  );
}

/** Neutral card with a consistent radius, border and hover lift. */
export function AppCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-border bg-card p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
