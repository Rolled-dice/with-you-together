import { createFileRoute } from "@tanstack/react-router";

/** Cron target: queues WhatsApp medicine reminders for doses due shortly. */
export const Route = createFileRoute("/api/public/hooks/whatsapp-reminders")({
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
          const { sendDueDoseReminders } = await import("@/lib/whatsapp/reminders.server");
          const { drainOutbox } = await import("@/lib/whatsapp/provider.server");
          const reminders = await sendDueDoseReminders();
          const drain = await drainOutbox();
          return Response.json({ ok: true, ...reminders, ...drain });
        } catch (e) {
          console.error("whatsapp reminders failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
