import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { AppCard } from "@/components/app-page";
import { gentleProblem } from "@/components/gentle-nudge";
import { Orb } from "@/components/landing/playroom-orb";
import { Button } from "@/components/ui/button";
import {
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
} from "@/lib/google-calendar.functions";

const DISMISS_KEY = "medcal:dismissed";

/**
 * Contextual Google Calendar offer, shown at the point of need: once a member
 * has at least one medication saved but hasn't connected their calendar. This
 * is where the value is obvious — "you added a pill, want its reminders on your
 * phone's calendar?" — rather than a cold Connect button in Settings.
 *
 * Reuses the exact same startGoogleCalendarConnect flow as the Settings card;
 * this only changes WHERE and WHEN the offer appears. It renders nothing when:
 *   - there are no medications yet (no context to justify it)
 *   - the calendar is already connected (nothing to offer)
 *   - the member dismissed it (remembered per-browser)
 */
export function MedicationCalendarPrompt({
  hasMedications,
}: {
  hasMedications: boolean;
}) {
  const statusFn = useServerFn(getGoogleCalendarStatus);
  const startFn = useServerFn(startGoogleCalendarConnect);

  const [dismissed, setDismissed] = useState(true); // assume dismissed until read
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const status = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => statusFn(),
    // Only worth asking once we have a reason to show the prompt at all.
    enabled: hasMedications && !dismissed,
  });

  const connect = useMutation({
    mutationFn: () => startFn(),
    onSuccess: (result) => {
      if (!result.ok) {
        gentleProblem("Google Calendar is not available", result.message);
        return;
      }
      window.location.href = result.url;
    },
    onError: (e) =>
      gentleProblem(
        "We could not start the Google Calendar connection",
        e instanceof Error ? e.message : "",
      ),
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // best effort
    }
    setDismissed(true);
  };

  // Gate rendering: needs a medication, not dismissed, status loaded, and not
  // already connected.
  if (!hasMedications || dismissed) return null;
  if (!status.data || status.data.connected) return null;

  return (
    <AppCard className="border-primary/25 bg-primary/5">
      <div className="flex items-start gap-4">
        <Orb tone="periwinkle" face="smile" gaze className="h-12 w-12 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">
            Want these reminders on your Google Calendar?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Connect once and every dose time shows up with Google&rsquo;s own
            alerts on their phone — no app for them to open.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="h-11 rounded-full px-5 font-bold"
            >
              <CalendarPlusIcon className="mr-2 h-4 w-4" />
              {connect.isPending ? "Opening Google…" : "Connect Google Calendar"}
            </Button>
            <Button
              variant="ghost"
              onClick={dismiss}
              className="h-11 rounded-full font-bold text-muted-foreground"
            >
              Not now
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </AppCard>
  );
}
