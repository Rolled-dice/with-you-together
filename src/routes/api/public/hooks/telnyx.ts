import { createFileRoute } from "@tanstack/react-router";

/**
 * Telnyx Call Control webhook. Every payload is verified with the Telnyx
 * Ed25519 public key before anything is written.
 */
export const Route = createFileRoute("/api/public/hooks/telnyx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyTelnyxSignature } = await import("@/lib/telnyx.server");
        const ok = await verifyTelnyxSignature(
          raw,
          request.headers.get("telnyx-signature-ed25519"),
          request.headers.get("telnyx-timestamp"),
        );
        if (!ok) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const payload = JSON.parse(raw);
          const { handleTelnyxEvent } = await import("@/lib/telnyx-calls.server");
          const result = await handleTelnyxEvent(payload);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("telnyx webhook failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
