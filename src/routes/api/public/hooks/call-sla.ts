import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/call-sla")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!key || !expected || key !== expected) {
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
