import { createFileRoute } from "@tanstack/react-router";

/**
 * Inbound WhatsApp webhook, provider agnostic.
 *
 * Accepts either a provider form post (Twilio/Plivo style: `From`, `Body`,
 * `MediaUrl0`) or a plain JSON body `{ from, body, media_url }` used by the
 * built-in simulator. Until a provider is connected, callers must present the
 * project's publishable key (or WHATSAPP_WEBHOOK_TOKEN) so the endpoint isn't
 * openly writable.
 */
export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token =
          url.searchParams.get("token") ??
          request.headers.get("x-webhook-token") ??
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");

        const expected = [
          process.env["WHATSAPP_WEBHOOK_TOKEN"],
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
        ].filter(Boolean) as string[];

        if (!token || !expected.includes(token)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let from = "";
        let body = "";
        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        const contentType = request.headers.get("content-type") ?? "";
        try {
          if (contentType.includes("application/json")) {
            const json = (await request.json()) as Record<string, unknown>;
            from = String(json.from ?? json.From ?? json.phone ?? "");
            body = String(json.body ?? json.Body ?? json.text ?? "");
            mediaUrl = (json.media_url ?? json.MediaUrl0 ?? null) as string | null;
            mediaType = (json.media_type ?? json.MediaContentType0 ?? null) as string | null;
          } else {
            const form = await request.formData();
            from = String(form.get("From") ?? form.get("from") ?? form.get("Src") ?? "");
            body = String(form.get("Body") ?? form.get("body") ?? form.get("Text") ?? "");
            mediaUrl = (form.get("MediaUrl0") as string | null) ?? null;
            mediaType = (form.get("MediaContentType0") as string | null) ?? null;
          }
        } catch {
          return new Response(JSON.stringify({ error: "Bad request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!from) {
          return new Response(JSON.stringify({ error: "Missing sender" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { handleInbound } = await import("@/lib/whatsapp/bot.server");
          const result = await handleInbound({
            phone: from,
            body: body.slice(0, 2000),
            mediaUrl,
            mediaType,
          });
          return Response.json({ ...result, ok: true });
        } catch (e) {
          console.error("whatsapp webhook failed", e);
          return new Response(JSON.stringify({ ok: false, error: "handler failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
