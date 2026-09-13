import { createFileRoute } from "@tanstack/react-router";

/** Cron target: delivers due Send It Later messages and notifies recipients. */
export const Route = createFileRoute("/api/public/hooks/send-later")({
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
          const { deliverDueMessages } = await import(
            "@/lib/send-later-delivery.server"
          );
          const result = await deliverDueMessages();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("send-later delivery failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
