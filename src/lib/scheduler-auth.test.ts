import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { schedulerAuthorized } from "./scheduler-auth.server";
import { vi } from "vitest";
vi.stubGlobal("crypto", webcrypto);
describe("scheduler authorization", () => {
  it("fails closed without a dedicated secret and rejects public keys", async () => {
    const request = new Request("https://example.test", {
      headers: { apikey: "public-supabase-key" },
    });
    expect(await schedulerAuthorized(request, undefined)).toBe(false);
    expect(await schedulerAuthorized(request, "dedicated-secret-that-is-long-enough-123")).toBe(
      false,
    );
  });
  it("accepts only the exact configured scheduler secret", async () => {
    const secret = "dedicated-secret-that-is-long-enough-123";
    expect(
      await schedulerAuthorized(
        new Request("https://example.test", { headers: { Authorization: `Bearer ${secret}` } }),
        secret,
      ),
    ).toBe(true);
    expect(
      await schedulerAuthorized(
        new Request("https://example.test", { headers: { apikey: secret + "x" } }),
        secret,
      ),
    ).toBe(false);
  });
});
