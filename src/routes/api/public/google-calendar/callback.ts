import { createFileRoute } from "@tanstack/react-router";

/**
 * Legacy Google Calendar OAuth callback route.
 * Zero-OAuth calendar synchronization has replaced this flow.
 * Any incoming traffic is redirected directly to the reminders page.
 */
export const Route = createFileRoute("/api/public/google-calendar/callback")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(null, {
          status: 302,
          headers: { Location: "/reminders" },
        });
      },
    },
  },
});
