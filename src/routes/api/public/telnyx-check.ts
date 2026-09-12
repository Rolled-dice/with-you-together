import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary health check for the Telnyx credential configuration.
 * Returns whether the config is present and whether a softphone token can be
 * minted. Does not place any calls.
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
        try {
          const token = await mintAgentToken(cfg);
          return Response.json({
            ok: true,
            callerId: cfg.callerId,
            connectionId: cfg.connectionId,
            credentialId: cfg.credentialId,
            tokenLength: token.length,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Token mint failed";
          return Response.json({ ok: false, config: true, error: message });
        }
      },
    },
  },
});
