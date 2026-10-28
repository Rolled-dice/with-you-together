import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/calendar-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAuthorizedCronRequest(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { runCalendarSyncWindow } = await import("@/lib/calendar-sync");
          const result = await runCalendarSyncWindow();
          return Response.json(
            { ok: result.failed === 0, ...result },
            { status: result.failed ? 502 : 200 },
          );
        } catch (e) {
          console.error("calendar-sync hook failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: "Calendar synchronization failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
