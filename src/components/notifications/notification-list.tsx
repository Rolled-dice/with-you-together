import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * PRESENTATIONAL (Tier 1, see docs/architecture/expo-readiness.md).
 *
 * Pure props-in / JSX-out. No data fetching, no router, no window/document,
 * no Supabase. Renders a notification thread and reports intent (dismiss)
 * upward via callbacks. This is the portable core: on a future Expo port it
 * maps to a React Native view with near-identical props, while its container
 * (NotificationBell) is rewritten with native data + presentation.
 */

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  read_at: string | null;
  created_at: string;
};

const SEVERITY_CLASS: Record<string, string> = {
  info: "border-border",
  warning: "border-amber-300 bg-amber-50/60",
  critical: "border-red-300 bg-red-50/60",
};

export function NotificationList({
  items,
  onDismiss,
  className,
  disabled = false,
}: {
  items: NotificationItem[];
  onDismiss: (id: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className={cn("px-2 py-6 text-center text-sm text-muted-foreground", className)}>
        Nothing yet. Your updates will appear here.
      </p>
    );
  }

  return (
    <div className={className}>
      {items.map((n) => (
        <div
          key={n.id}
          className={cn(
            "mb-2 rounded-2xl border p-3.5 transition-all duration-200 hover:shadow-gentle last:mb-0",
            SEVERITY_CLASS[n.severity] ?? "border-border bg-card/60",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            {!n.read_at && (
              <span className="flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-pulse" />
                Unread
              </span>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              disabled={disabled}
              onClick={() => onDismiss(n.id)}
              className="flex min-h-8 min-w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:text-foreground"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {new Date(n.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
