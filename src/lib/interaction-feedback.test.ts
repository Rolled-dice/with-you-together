import { beforeEach, describe, expect, it, vi } from "vitest";
let created = 0;
const oscillators: {
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
  disconnect: ReturnType<typeof vi.fn>;
  onended?: () => void;
}[] = [];
const suspend = vi.fn().mockResolvedValue(undefined);
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  constructor() {
    created++;
  }
  suspend = suspend;
  createOscillator() {
    const oscillator = {
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: undefined,
    };
    oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  created = 0;
  oscillators.length = 0;
});
describe("interaction audio", () => {
  it("creates audio only on interaction and respects persisted mute", async () => {
    const audio = await import("./interaction-feedback");
    expect(created).toBe(0);
    audio.setSoundEnabled(false);
    audio.playSoftChime();
    expect(created).toBe(0);
    audio.loadSoundPreference();
    expect(audio.getSoundEnabled()).toBe(false);
    audio.setSoundEnabled(true);
    audio.playSoftChime();
    expect(created).toBe(1);
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(528, 0);
    oscillators[0].onended?.();
    expect(oscillators[0].disconnect).toHaveBeenCalled();
    audio.setSoundEnabled(false);
    expect(suspend).toHaveBeenCalled();
  });
});
