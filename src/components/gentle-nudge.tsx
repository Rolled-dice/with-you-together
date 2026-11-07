import { toast } from "sonner";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Gentle nudges, the SomeoneNear notification language.
 * Never a red dot, never a loud pop. A warm pulse and a quiet sentence.
 */

export function NudgeDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)} aria-hidden>
      <span className="absolute inset-0 rounded-full bg-primary/50 animate-gentle-breathe" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  );
}

export function GentleNudge({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-gentle-rise flex items-start gap-4 rounded-3xl border border-border bg-surface p-5 shadow-gentle",
        className,
      )}
    >
      <span className="mt-1.5">
        <NudgeDot />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-display text-sm font-medium text-foreground">{title}</p>
        {body ? <p className="text-sm leading-relaxed text-muted-foreground">{body}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A soft toast. Use instead of success/error toasts anywhere a person is being cared for. */
export function gentleToast(title: string, description?: string) {
  return toast(title, { description, duration: 5000 });
}

/** For things that genuinely went wrong, still calm, still kind. */
export function gentleProblem(title: string, description?: string) {
  return toast(title, {
    description: description ?? "Nothing is lost. You can try again whenever you're ready.",
    duration: 7000,
  });
}
