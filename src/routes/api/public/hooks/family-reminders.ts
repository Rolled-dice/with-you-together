import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";
import { deliverFamilyReminders } from "@/lib/family-delivery.server";
export const Route = createFileRoute("/api/public/hooks/family-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAuthorizedCronRequest(request)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          return Response.json(await deliverFamilyReminders());
        } catch {
          return Response.json({ error: "Reminder delivery failed" }, { status: 500 });
        }
      },
    },
  },
});
