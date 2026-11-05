import { Blob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), download: vi.fn() }));
vi.mock("ai", () => ({ generateText: mocks.generate, Output: { object: vi.fn() } }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: () => () => "gemini" }));
import { readPrescription } from "./prescription.server";
const userId = "00000000-0000-4000-8000-000000000001";
const context = {
  userId,
  supabase: { storage: { from: () => ({ download: mocks.download }) } },
} as unknown as Parameters<typeof readPrescription>[0];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.download.mockResolvedValue({
    data: new Blob(["synthetic"], { type: "image/png" }),
    error: null,
  });
});
describe("private prescription extraction", () => {
  it("rejects another owner's path before touching storage or AI", async () => {
    await expect(readPrescription(context, "another-user/image.png", "key")).rejects.toThrow(
      /own uploads/,
    );
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects empty, oversized and unsupported objects before AI", async () => {
    for (const photo of [
      new Blob([], { type: "image/png" }),
      new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "image/png" }),
      new Blob(["text"], { type: "text/plain" }),
    ]) {
      mocks.download.mockResolvedValueOnce({ data: photo, error: null });
      await expect(readPrescription(context, `${userId}/photo.png`, "key")).rejects.toThrow(
        /smaller than 10 MB/,
      );
    }
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("returns validated extraction without creating a medication", async () => {
    mocks.generate.mockResolvedValue({
      output: { doctor: null, date: null, medications: [{ name: "SYNTHETIC TEST", dosage: null }] },
    });
    expect(
      (await readPrescription(context, `${userId}/photo.png`, "key")).medications,
    ).toHaveLength(1);
    const call = mocks.generate.mock.calls[0][0];
    expect(call.messages[0].content[1].image).toBeInstanceOf(Uint8Array);
    expect(call.system).toMatch(/draft.*review/);
  });
  it("rejects invalid model output with a generic, non-provider error", async () => {
    mocks.generate.mockResolvedValue({ output: { medications: [{ times_per_day: 999 }] } });
    await expect(readPrescription(context, `${userId}/photo.png`, "key")).rejects.toThrow(
      /confidently/,
    );
  });
});
