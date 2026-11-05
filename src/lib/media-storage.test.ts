import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { sendLaterStoragePath } from "./media-storage.server";
const owner = "00000000-0000-4000-8000-000000000001";
describe("private media paths", () => {
  it("accepts owner paths and the legacy database prefix", () => {
    expect(sendLaterStoragePath(`${owner}/clip.webm`, owner)).toBe(`${owner}/clip.webm`);
    expect(sendLaterStoragePath(`send-later/${owner}/clip.webm`, owner)).toBe(`${owner}/clip.webm`);
  });
  it("rejects foreign owners and path traversal before privileged signing", () => {
    expect(() => sendLaterStoragePath("other/clip.webm", owner)).toThrow();
    expect(() => sendLaterStoragePath(`${owner}/../clip.webm`, owner)).toThrow();
    expect(() => sendLaterStoragePath(`${owner}/..`, owner)).toThrow();
  });
});
