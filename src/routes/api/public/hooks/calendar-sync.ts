import { schedulerAuthorized } from "@/lib/scheduler-auth.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/calendar-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await schedulerAuthorized(request, process.env.CRON_SECRET))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { runCalendarSyncWindow } = await import("@/lib/calendar/sync.server");
          const result = await runCalendarSyncWindow();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("calendar-sync hook failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
