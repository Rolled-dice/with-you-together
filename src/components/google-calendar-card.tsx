import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheckIcon, CalendarPlusIcon } from "@phosphor-icons/react";
import {
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
  setCalendarSyncEnabled,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { gentleProblem, gentleToast } from "@/components/gentle-nudge";

export function GoogleCalendarCard() {
  const qc = useQueryClient();
  const status = useServerFn(getGoogleCalendarStatus);
  const start = useServerFn(startGoogleCalendarConnect);
  const toggle = useServerFn(setCalendarSyncEnabled);
  const disconnect = useServerFn(disconnectGoogleCalendar);

  const q = useQuery({ queryKey: ["google-calendar-status"], queryFn: () => status() });
  const data = q.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["google-calendar-status"] });

  const onConnect = async () => {
    try {
      const { url } = await start();
      window.location.href = url;
    } catch (error) {
      gentleProblem(
        "We could not start the Google Calendar connection",
        error instanceof Error ? error.message : "",
      );
    }
  };

  return (
    <section
      className="rounded-3xl border border-border bg-card p-5 shadow-gentle"
      aria-labelledby="gcal-title"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">
          {data?.connected ? (
            <CalendarCheck className="size-5" />
          ) : (
            <CalendarPlus className="size-5" />
          )}
        </div>
        <div className="flex-1">
          <p id="gcal-title" className="font-display text-lg font-medium text-foreground">
            Google Calendar
          </p>
          {!data?.connected ? (
            <>
              <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                Connect your Google Calendar so medication and reminder times show up with
                Google&rsquo;s own alerts.
              </p>
              <Button className="mt-4 min-h-11 rounded-xl px-5 text-base" onClick={onConnect}>
                Connect Google Calendar
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                Connected as {data.google_email ?? "your Google account"}. Reminders for your family
                appear here.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Switch
                  checked={data.sync_enabled}
                  onCheckedChange={async (v) => {
                    try {
                      await toggle({ data: { enabled: v } });
                      invalidate();
                    } catch (error) {
                      gentleProblem(
                        "We could not update calendar syncing",
                        error instanceof Error ? error.message : "",
                      );
                    }
                  }}
                  aria-label="Toggle Google Calendar sync"
                />
                <span className="text-base text-muted-foreground">
                  Syncing {data.sync_enabled ? "on" : "off"}
                </span>
              </div>
              <Button
                className="mt-4 min-h-11 rounded-xl px-5 text-base"
                variant="outline"
                onClick={async () => {
                  try {
                    await disconnect();
                    invalidate();
                    gentleToast("Google Calendar disconnected");
                  } catch (error) {
                    gentleProblem(
                      "We could not disconnect",
                      error instanceof Error ? error.message : "",
                    );
                  }
                }}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
