// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_VOICE_BYTES } from "@/lib/companion-voice";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth }) }));
import { handleCompanionTranscription } from "./transcription.server";

const provider = vi.fn();
const limit = vi.fn();
function request({
  token = "valid",
  type = "audio/webm;codecs=opus",
  body = new Uint8Array([1, 2, 3]),
  language = "en-IN",
  binding = true,
} = {}) {
  const req = new Request(`https://example.test/api/companion-transcription?language=${language}`, {
    method: "POST",
    headers: { Authorization: token ? `Bearer ${token}` : "", "Content-Type": type },
    body,
  });
  if (binding)
    Object.defineProperty(req, "runtime", {
      value: { cloudflare: { env: { COMPANION_VOICE_LIMITER: { limit } } } },
    });
  return req;
}
function reply(text = "I feel happy today", finishReason = "STOP") {
  return Response.json({
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify({ text }) }] } }],
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubEnv("GEMINI_API_KEY", "private-test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-3-flash-preview");
  vi.stubEnv("GEMINI_TRANSCRIPTION_MODEL", "");
  vi.stubGlobal("fetch", provider);
  auth.getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
  limit.mockResolvedValue({ success: true });
  provider.mockResolvedValue(reply());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Companion transcription boundary", () => {
  it("requires a verified login before processing audio", async () => {
    expect((await handleCompanionTranscription(request({ token: "" }))).status).toBe(401);
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    expect((await handleCompanionTranscription(request())).status).toBe(401);
    expect(provider).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });
  it("rate limits by verified user and fails closed without the production binding", async () => {
    limit.mockResolvedValue({ success: false });
    const response = await handleCompanionTranscription(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(limit).toHaveBeenCalledWith({ key: "companion-voice:member" });
    expect((await handleCompanionTranscription(request({ binding: false }))).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects unsupported formats, languages, empty audio and oversized audio", async () => {
    expect((await handleCompanionTranscription(request({ type: "text/plain" }))).status).toBe(400);
    expect(
      (await handleCompanionTranscription(request({ language: "arbitrary instructions" }))).status,
    ).toBe(400);
    expect((await handleCompanionTranscription(request({ body: new Uint8Array() }))).status).toBe(
      400,
    );
    expect(
      (await handleCompanionTranscription(request({ body: new Uint8Array(MAX_VOICE_BYTES + 1) })))
        .status,
    ).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  });
  it("transcribes without storing audio or exposing credentials", async () => {
    const response = await handleCompanionTranscription(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "I feel happy today" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [url, options] = provider.mock.calls[0];
    expect(url).not.toContain("private-test-key");
    expect(options.headers["x-goog-api-key"]).toBe("private-test-key");
    const payload = JSON.parse(options.body);
    expect(payload.contents[0].parts[0].inline_data).toEqual({
      mime_type: "audio/webm",
      data: "AQID",
    });
    expect(payload.system_instruction.parts[0].text).toContain("Do not translate");
    expect(payload.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });
  it("normalizes Safari MP4 audio, preserving Hindi rather than translating it", async () => {
    const response = await handleCompanionTranscription(
      request({ type: "audio/mp4", language: "hi-IN" }),
    );
    expect(response.status).toBe(200);
    const payload = JSON.parse(provider.mock.calls[0][1].body);
    expect(payload.contents[0].parts[0].inline_data.mime_type).toBe("audio/m4a");
    expect(payload.system_instruction.parts[0].text).toContain("Hindi");
  });
  it("rejects empty, partial, malformed and overlong provider results", async () => {
    provider.mockResolvedValueOnce(reply(""));
    expect((await handleCompanionTranscription(request())).status).toBe(422);
    provider.mockResolvedValueOnce(reply("cut off", "MAX_TOKENS"));
    expect((await handleCompanionTranscription(request())).status).toBe(422);
    provider.mockResolvedValueOnce(Response.json({ unexpected: true }));
    expect((await handleCompanionTranscription(request())).status).toBe(503);
    provider.mockResolvedValueOnce(reply("x".repeat(8001)));
    expect((await handleCompanionTranscription(request())).status).toBe(503);
  });
  it("keeps provider failures and timeouts out of the response", async () => {
    provider.mockRejectedValueOnce(new Error("private provider details"));
    const response = await handleCompanionTranscription(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider details");
  });
});
