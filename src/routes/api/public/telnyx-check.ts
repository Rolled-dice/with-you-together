import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary health check for the Telnyx credential configuration.
 * Returns whether the config is present and attempts a few read-only API probes.
 * Does not place any calls.
 */
export const Route = createFileRoute("/api/public/telnyx-check")({
  server: {
    handlers: {
      GET: async () => {
        const { telnyxConfig, mintAgentToken } = await import("@/lib/telnyx.server");
        const cfg = telnyxConfig();
        if (!cfg) {
          return Response.json({ ok: false, error: "Telnyx config is incomplete" });
        }

        const probe = async (url: string) => {
          try {
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
            });
            return { status: res.status, body: await res.text() };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        };

        const [numberCheck, appCheck, credentialsList, tokenResult] = await Promise.all([
          probe(`https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(cfg.callerId)}`),
          probe(`https://api.telnyx.com/v2/call_control_applications/${cfg.connectionId}`),
          probe("https://api.telnyx.com/v2/telephony_credentials?page[size]=20"),
          (async () => {
            try {
              const token = await mintAgentToken(cfg);
              return { ok: true, tokenLength: token.length };
            } catch (e) {
              return { ok: false, error: e instanceof Error ? e.message : "Token mint failed" };
            }
          })(),
        ]);

        return Response.json({
          ok: tokenResult.ok ?? false,
          callerId: cfg.callerId,
          connectionId: cfg.connectionId,
          credentialId: cfg.credentialId,
          tokenResult,
          numberCheck,
          appCheck,
          credentialsList,
        });
      },
    },
  },
});
