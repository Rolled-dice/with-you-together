import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRecording, useObjectUrl } from "./use-recording";
afterEach(() => vi.unstubAllGlobals());
describe("microphone ownership", () => {
  it("stops a stream whose permission resolves after cancellation", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    let resolve!: (stream: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: () =>
          new Promise<MediaStream>((r) => {
            resolve = r;
          }),
      },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
      },
    );
    const { result } = renderHook(() => useRecording());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.start("voice");
    });
    act(() => result.current.cancel());
    await act(async () => {
      resolve(stream);
      await pending;
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.recording).toBe(false);
  });
  it("releases microphone when recorder construction fails", async () => {
    const stop = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        constructor() {
          throw new Error("unsupported encoder");
        }
      },
    );
    const { result } = renderHook(() => useRecording());
    await act(async () => result.current.start("voice"));
    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.error).toContain("encoder");
  });
  it("revokes previews on replacement and unmount", () => {
    const revoke = vi.fn();
    const create = vi.fn().mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const { rerender, unmount } = renderHook(({ blob }) => useObjectUrl(blob), {
      initialProps: { blob: new Blob(["first"]) },
    });
    rerender({ blob: new Blob(["second"]) });
    expect(revoke).toHaveBeenCalledWith("blob:first");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:second");
  });
});
