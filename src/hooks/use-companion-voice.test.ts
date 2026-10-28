import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCompanionVoice,
  type VoiceRecognition,
  type VoiceRecognitionResult,
} from "./use-companion-voice";

class FakeRecognition implements VoiceRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: VoiceRecognition["onstart"] = null;
  onresult: VoiceRecognition["onresult"] = null;
  onerror: VoiceRecognition["onerror"] = null;
  onend: VoiceRecognition["onend"] = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
  result(results: VoiceRecognitionResult[]) {
    this.onresult?.({ resultIndex: 0, results });
  }
}
function words(text: string, isFinal: boolean): VoiceRecognitionResult {
  return { isFinal, 0: { transcript: text } };
}
function setup(disabled = false) {
  const onTranscript = vi.fn();
  const transcribe = vi.fn(async () => "Recorded words");
  const hook = renderHook(() =>
    useCompanionVoice({ language: "en-IN", disabled, onTranscript, transcribe }),
  );
  return { ...hook, onTranscript, transcribe };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  FakeRecognition.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Companion live dictation", () => {
  it("uses the chosen language, continuous listening and interim results", async () => {
    const { result, onTranscript } = setup();
    await act(() => result.current.start());
    const live = FakeRecognition.instances[0];
    expect(live.lang).toBe("en-IN");
    expect(live.continuous).toBe(true);
    expect(live.interimResults).toBe(true);
    act(() => live.result([words("I feel", false)]));
    expect(result.current.interim).toBe("I feel");
    expect(onTranscript).not.toHaveBeenCalled();
    act(() => live.result([words("I feel happy", true)]));
    expect(onTranscript).toHaveBeenCalledWith("I feel happy");
    act(() => live.result([words("I feel happy", true), words("today", false)]));
    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(result.current.interim).toBe("today");
  });

  it("continues across pauses, and does not duplicate earlier phrases", async () => {
    const { result, onTranscript } = setup();
    await act(() => result.current.start());
    const live = FakeRecognition.instances[0];
    act(() => live.result([words("First sentence", true)]));
    act(() => live.onend?.());
    act(() => vi.advanceTimersByTime(250));
    expect(live.start).toHaveBeenCalledTimes(2);
    act(() => live.result([words("Second sentence", true)]));
    expect(onTranscript.mock.calls).toEqual([["First sentence"], ["Second sentence"]]);
    act(() => result.current.stop());
    expect(result.current.state.kind).toBe("idle");
    act(() => vi.advanceTimersByTime(2000));
    expect(live.start).toHaveBeenCalledTimes(2);
  });

  it("keeps the last partial words when Stop is pressed", async () => {
    const { result, onTranscript } = setup();
    await act(() => result.current.start());
    const live = FakeRecognition.instances[0];
    act(() => live.result([words("Please listen", false)]));
    act(() => result.current.stop());
    expect(onTranscript).toHaveBeenCalledWith("Please listen");
    expect(result.current.isActive).toBe(false);
  });

  it("does not let an old stop timeout cancel a new session", async () => {
    const { result } = setup();
    await act(() => result.current.start());
    act(() => result.current.stop());
    await act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.state.kind).toBe("listening");
  });

  it("stops at two minutes without sending anything", async () => {
    const { result, onTranscript } = setup();
    await act(() => result.current.start());
    act(() => vi.advanceTimersByTime(120000));
    expect(result.current.state.kind).toBe("idle");
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("handles denied access and prevents restart loops", async () => {
    const { result } = setup();
    await act(() => result.current.start());
    const live = FakeRecognition.instances[0];
    act(() => live.onerror?.({ error: "not-allowed" }));
    expect(result.current.state).toMatchObject({
      kind: "error",
      message: expect.stringContaining("denied"),
    });
    expect(live.abort).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(30000));
    expect(live.start).toHaveBeenCalledTimes(1);
  });

  it("allows no-speech pauses, but stops after repeated silence", async () => {
    const { result } = setup();
    await act(() => result.current.start());
    const live = FakeRecognition.instances[0];
    for (let i = 0; i < 3; i++) {
      act(() => {
        live.onerror?.({ error: "no-speech" });
        live.onend?.();
        vi.advanceTimersByTime(250);
      });
    }
    expect(result.current.state.kind).toBe("error");
  });

  it("releases the microphone on navigation and unmount", async () => {
    const { result, unmount } = setup();
    await act(() => result.current.start());
    const live = FakeRecognition.instances[0];
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(live.abort).toHaveBeenCalled();
    expect(result.current.state.kind).toBe("idle");
    await act(() => result.current.start());
    const next = FakeRecognition.instances[1];
    unmount();
    expect(next.abort).toHaveBeenCalled();
    expect(next.onresult).toBeNull();
  });

  it("never opens the microphone when disabled", async () => {
    const { result } = setup(true);
    await act(() => result.current.start());
    expect(FakeRecognition.instances).toHaveLength(0);
  });
});

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) });
    this.onstop?.();
  });
  constructor() {
    FakeRecorder.instances.push(this);
  }
}

function recordingSetup() {
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", undefined);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  FakeRecorder.instances = [];
  const track = { stop: vi.fn(), onended: null };
  const audioStream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const getUserMedia = vi.fn(async () => audioStream);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { track, audioStream, getUserMedia, ...setup() };
}

describe("Companion recording fallback", () => {
  it("requires a new recording instead of retrying audio with no recognized speech", async () => {
    const { result, transcribe, onTranscript, getUserMedia } = recordingSetup();
    transcribe.mockResolvedValueOnce("");
    await act(() => result.current.start());
    await act(() => result.current.stop());
    expect(result.current.state).toMatchObject({ kind: "error", retryable: false });
    await act(() => result.current.retry());
    expect(transcribe).toHaveBeenCalledTimes(1);
    await act(() => result.current.start());
    await act(() => result.current.stop());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(onTranscript).toHaveBeenCalledWith("Recorded words");
  });
  it("requests speech-friendly microphone settings and releases it before transcription", async () => {
    const { result, getUserMedia, track, transcribe, onTranscript } = recordingSetup();
    await act(() => result.current.start());
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    expect(result.current.state).toEqual({ kind: "listening", mode: "recording" });
    await act(() => result.current.stop());
    expect(track.stop).toHaveBeenCalled();
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith("Recorded words");
    expect(result.current.state.kind).toBe("idle");
  });

  it("does not upload cancelled recordings", async () => {
    const { result, transcribe, onTranscript, track } = recordingSetup();
    await act(() => result.current.start());
    act(() => result.current.cancel());
    expect(transcribe).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });

  it("keeps a failed recording for an explicit retry, without recording again", async () => {
    const { result, transcribe, onTranscript, getUserMedia } = recordingSetup();
    transcribe.mockRejectedValueOnce(new Error("Connection interrupted"));
    await act(() => result.current.start());
    await act(() => result.current.stop());
    expect(result.current.state).toEqual({
      kind: "error",
      message: "Connection interrupted",
      retryable: true,
    });
    await act(() => result.current.retry());
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it("stops a microphone granted after the user has already cancelled", async () => {
    const { result, getUserMedia, audioStream, track, transcribe } = recordingSetup();
    let grant = () => {};
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          grant = () => resolve(audioStream);
        }),
    );
    let pending: Promise<void>;
    act(() => {
      pending = result.current.start();
    });
    act(() => result.current.cancel());
    await act(async () => {
      grant();
      await pending;
    });
    expect(track.stop).toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(transcribe).not.toHaveBeenCalled();
  });
});
