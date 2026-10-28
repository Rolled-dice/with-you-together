import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

/** Cron target: delivers due Send It Later messages and notifies recipients. */
export const Route = createFileRoute("/api/public/hooks/send-later")({
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
          const { deliverDueMessages } = await import("@/lib/send-later-delivery.server");
          const result = await deliverDueMessages();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("send-later delivery failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: "Scheduled message delivery failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
