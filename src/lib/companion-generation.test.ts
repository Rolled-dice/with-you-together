import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  check: vi.fn(),
  save: vi.fn(),
  generate: vi.fn(),
  model: vi.fn(() => "gemini-model"),
}));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: () => mocks.model }));
vi.mock("ai", () => ({ generateText: mocks.generate }));
vi.mock("./companion-store.server", () => ({
  createCompanionStore: () => ({
    loadSummary: mocks.load,
    check: mocks.check,
    saveSummary: mocks.save,
  }),
}));
import { generateCompanionReply, COMPANION_BLOCKED_REPLY } from "./companion-generation.server";
const input = {
  environment: { GEMINI_API_KEY: "synthetic" },
  subjectId: "00000000-0000-4000-8000-000000000001",
  system: "Companion",
  messages: [{ role: "user" as const, content: "Hello" }],
  userText: "Hello",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.model.mockReturnValue("gemini-model");
  mocks.load.mockResolvedValue(null);
  mocks.check.mockResolvedValue(false);
  mocks.save.mockResolvedValue(undefined);
  mocks.generate
    .mockResolvedValueOnce({ text: "A checked reply" })
    .mockResolvedValueOnce({ text: "A short summary" });
});
describe("Gemini with independent safety checks", () => {
  it("blocks unsafe input before calling Gemini", async () => {
    mocks.check.mockResolvedValueOnce(true);
    expect((await generateCompanionReply(input)).text).toBe(COMPANION_BLOCKED_REPLY);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("never releases a blocked model response or saves its summary", async () => {
    mocks.check.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await generateCompanionReply(input)).text).toBe(COMPANION_BLOCKED_REPLY);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("uses Gemini and saves only a separately checked continuity summary", async () => {
    const result = await generateCompanionReply(input);
    expect(result.text).toBe("A checked reply");
    expect(mocks.save).not.toHaveBeenCalled();
    await result.persistContinuity();
    expect(mocks.model).toHaveBeenCalledWith("gemini-3-flash-preview");
    expect(mocks.check).toHaveBeenNthCalledWith(
      3,
      input.subjectId,
      "A short summary",
      "OUTPUT",
      "summary",
    );
    expect(mocks.save).toHaveBeenCalledWith(input.subjectId, "A short summary", null);
  });
  it("fails closed when a safety service is unavailable", async () => {
    mocks.check.mockRejectedValue(new Error("unavailable"));
    await expect(generateCompanionReply(input)).rejects.toThrow("unavailable");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
