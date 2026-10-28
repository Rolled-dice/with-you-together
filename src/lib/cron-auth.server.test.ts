// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth.server";

afterEach(() => vi.unstubAllEnvs());
const secret = "private-test-secret-".repeat(3);
function request(headers: HeadersInit = {}) {
  return new Request("https://example.test/api/public/hooks/send-later", {
    method: "POST",
    headers,
  });
}
describe("Private cron authentication", () => {
  it("accepts only the configured private secret through Bearer or apikey", async () => {
    vi.stubEnv("CRON_HOOK_SECRET", secret);
    expect(await isAuthorizedCronRequest(request({ Authorization: `Bearer ${secret}` }))).toBe(
      true,
    );
    expect(await isAuthorizedCronRequest(request({ apikey: secret }))).toBe(true);
    expect(await isAuthorizedCronRequest(request({ apikey: "public-key" }))).toBe(false);
    expect(await isAuthorizedCronRequest(request({ Authorization: secret }))).toBe(false);
    expect(await isAuthorizedCronRequest(request())).toBe(false);
  });
  it.each(["", "short", "sb_publishable_public_".repeat(3)])(
    "fails closed for missing or unsafe configuration",
    async (value) => {
      vi.stubEnv("CRON_HOOK_SECRET", value);
      expect(await isAuthorizedCronRequest(request({ apikey: value }))).toBe(false);
    },
  );
  it.each(["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"])(
    "rejects a secret matching %s",
    async (key) => {
      vi.stubEnv("CRON_HOOK_SECRET", secret);
      vi.stubEnv(key, secret);
      expect(await isAuthorizedCronRequest(request({ apikey: secret }))).toBe(false);
    },
  );
});
