import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/call-sla")({
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
          const { evaluateSlaLadder } = await import("@/lib/sla-ladder.server");
          const result = await evaluateSlaLadder(null);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("call-sla ladder failed", e);
          return new Response(JSON.stringify({ ok: false, error: "Call SLA processing failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
