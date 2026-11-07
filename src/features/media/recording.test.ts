import { describe, expect, it } from "vitest";
import { mediaFile, recordingMime } from "./recording";
describe("recording format contract", () => {
  it("negotiates MP4 when the browser only supports MP4", () => {
    expect(recordingMime("voice", (type) => type === "audio/mp4")).toBe("audio/mp4");
    const file = mediaFile(new Blob(["audio"], { type: "audio/mp4" }), "voice");
    expect(file.name).toBe("message.mp4");
    expect(file.type).toBe("audio/mp4");
  });
  it("retains WebM codecs and the matching extension", () => {
    const type = recordingMime("voice", (value) => value.startsWith("audio/webm"));
    const file = mediaFile(new Blob(["audio"], { type }), "voice");
    expect(file.name).toBe("message.webm");
    expect(file.type).toBe(type);
  });
  it("rejects unsupported, empty, wrong-kind and oversized files", () => {
    expect(() => recordingMime("voice", () => false)).toThrow();
    expect(() => mediaFile(new Blob([], { type: "audio/mp4" }), "voice")).toThrow();
    expect(() => mediaFile(new Blob(["video"], { type: "video/mp4" }), "voice")).toThrow();
    expect(() =>
      mediaFile(new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: "audio/mp4" }), "voice"),
    ).toThrow();
  });
});
