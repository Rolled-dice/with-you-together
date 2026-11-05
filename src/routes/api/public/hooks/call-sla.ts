import { schedulerAuthorized } from "@/lib/scheduler-auth.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/call-sla")({
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
          const { evaluateSlaLadder } = await import("@/lib/sla-ladder.server");
          const result = await evaluateSlaLadder(null);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("call-sla ladder failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
