import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Supportive empty states. No photographs, a soft SVG mark, one honest line,
 * and a low-pressure way forward.
 */

export function QuietMark({ variant = "breath" }: { variant?: "breath" | "note" | "circle" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-24 w-24 text-primary/45"
      fill="none"
      aria-hidden
    >
      <circle
        cx="60"
        cy="60"
        r="44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 9"
        strokeLinecap="round"
      />
      {variant === "breath" && (
        <>
          <circle cx="60" cy="60" r="20" fill="currentColor" fillOpacity="0.18" />
          <path
            d="M46 64c5-9 9-9 14 0s9 9 14 0"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {variant === "note" && (
        <>
          <rect
            x="40"
            y="44"
            width="40"
            height="32"
            rx="8"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M48 56h24M48 64h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {variant === "circle" && (
        <>
          <circle cx="50" cy="58" r="8" stroke="currentColor" strokeWidth="2" />
          <circle cx="70" cy="58" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M44 76c4-6 12-6 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function QuietEmptyState({
  quote,
  title,
  body,
  action,
  variant = "breath",
  className,
}: {
  /** One of the SomeoneNear lines, sits above the title, in the person's own voice. */
  quote?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  variant?: "breath" | "note" | "circle";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-6 rounded-[2.5rem] border border-border bg-surface px-8 py-12 text-center shadow-gentle",
        className,
      )}
    >
      <QuietMark variant={variant} />
      <div className="space-y-3">
        {quote ? (
          <p className="mx-auto max-w-sm text-sm italic leading-relaxed text-muted-foreground">
            “{quote}”
          </p>
        ) : null}
        <h3 className="font-display text-xl font-medium text-foreground">{title}</h3>
        {body ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action}
    </section>
  );
}
