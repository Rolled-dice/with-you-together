import { createFileRoute } from "@tanstack/react-router";
import { schedulerAuthorized } from "@/lib/scheduler-auth.server";

export const Route = createFileRoute("/api/public/hooks/family-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !(await schedulerAuthorized(
            request,
            process.env.CRON_SECRET || process.env.CRON_HOOK_SECRET,
          ))
        )
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          const { deliverFamilyReminders } = await import("@/lib/family-reminder-delivery.server");
          return Response.json(await deliverFamilyReminders());
        } catch {
          return Response.json({ error: "Reminder delivery failed" }, { status: 500 });
        }
      },
    },
  },
});
