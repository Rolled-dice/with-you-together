import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheckIcon, ArrowsClockwiseIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { triggerCalendarSync } from "@/lib/calendar-sync.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { gentleProblem, gentleToast } from "@/components/gentle-nudge";

export function CalendarSyncCard() {
  const syncFn = useServerFn(triggerCalendarSync);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (result) => {
      if (result.ok) {
        setLastSynced(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        gentleToast("Calendar Invitations", result.message);
      } else {
        gentleProblem("Calendar Sync Problem", result.message);
      }
    },
    onError: (err) => {
      gentleProblem(
        "Sync Failed",
        err instanceof Error ? err.message : "Could not synchronize calendar",
      );
    },
  });

  return (
    <section
      className="rounded-3xl border border-border bg-card p-5 shadow-gentle"
      aria-labelledby="calendar-sync-title"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">
          <CalendarCheckIcon className="size-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              id="calendar-sync-title"
              className="font-display text-lg font-medium text-foreground"
            >
              Automatic Calendar Sync
            </p>
            <Badge variant="secondary" className="gap-1 text-xs">
              <CheckCircleIcon className="size-3 text-primary" weight="fill" />
              Zero-OAuth Native
            </Badge>
          </div>

          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            Doses and reminders sync automatically into Apple Calendar (iOS/macOS), Google Calendar
            (Android), and Desktop Outlook via secure RFC 5545 calendar invites. No Google sign-in
            or third-party permissions required.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">
              Apple Calendar
            </Badge>
            <Badge variant="outline" className="text-xs">
              Google Calendar
            </Badge>
            <Badge variant="outline" className="text-xs">
              Outlook
            </Badge>
            <Badge variant="outline" className="text-xs">
              RFC 5545 / iMIP
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              className="min-h-11 rounded-xl px-4 text-sm font-medium"
              variant="outline"
              disabled={sync.isPending}
              onClick={() => sync.mutate()}
            >
              <ArrowsClockwiseIcon
                className={`mr-2 size-4 ${sync.isPending ? "animate-spin" : ""}`}
              />
              {sync.isPending ? "Syncing Calendar…" : "Sync Now"}
            </Button>
            {lastSynced && (
              <span className="text-xs text-muted-foreground">Last synced at {lastSynced}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
