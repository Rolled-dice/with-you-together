// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(
  () => new Map<string, (input: { request: Request }) => Promise<Response>>(),
);
vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    (path: string) =>
    (config: {
      server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
    }) => {
      hooks.set(path, config.server.handlers.POST);
      return config;
    },
}));
import "@/routes/api/public/hooks/calendar-sync";
import "@/routes/api/public/hooks/send-later";
import "@/routes/api/public/hooks/call-sla";
import "@/routes/api/public/hooks/family-reminders";
afterEach(() => vi.unstubAllEnvs());
describe("Public cron routes", () => {
  it.each(["calendar-sync", "send-later", "call-sla", "family-reminders"])(
    "rejects browser-public credentials before running %s",
    async (name) => {
      const key = "browser-visible-public-key".repeat(2);
      vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", key);
      vi.stubEnv("CRON_HOOK_SECRET", "private-secret-different-from-public".repeat(2));
      const handler = hooks.get("/api/public/hooks/" + name);
      expect(handler).toBeDefined();
      const response = await handler!({
        request: new Request("https://example.test/hook", {
          method: "POST",
          headers: { apikey: key },
        }),
      });
      expect(response.status).toBe(401);
    },
  );
});
