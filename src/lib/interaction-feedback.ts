type Voice = {
  frequency: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
  endFrequency?: number;
};
let context: AudioContext | null = null;
let enabled = true;
const listeners = new Set<() => void>();
export const subscribeToSound = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSoundEnabled = () => enabled;
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem("sn_interaction_sound", value ? "on" : "off");
  } catch {
    /* Preference remains available for this tab. */
  }
  if (!value) void context?.suspend().catch(() => undefined);
  listeners.forEach((listener) => listener());
}
export function loadSoundPreference() {
  try {
    enabled = localStorage.getItem("sn_interaction_sound") !== "off";
  } catch {
    enabled = true;
  }
  listeners.forEach((listener) => listener());
}
export function playVoices(voices: Voice[]) {
  if (!enabled || typeof window === "undefined" || !window.AudioContext) return;
  try {
    context ??= new window.AudioContext();
    const audio = context;
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
    for (const voice of voices) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        now = audio.currentTime;
      oscillator.type = voice.type ?? "sine";
      oscillator.frequency.setValueAtTime(voice.frequency, now);
      if (voice.endFrequency)
        oscillator.frequency.exponentialRampToValueAtTime(
          voice.endFrequency,
          now + voice.duration * 0.85,
        );
      gain.gain.setValueAtTime(voice.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + voice.duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + voice.duration);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    /* Click feedback must never prevent the underlying action. */
  }
}
export const playSoftChime = (pitch = 1) =>
  playVoices([{ frequency: 528 * pitch, duration: 0.45, volume: 0.06 }]);
export const playBubblePop = (frequency = 420) =>
  playVoices([
    { frequency, endFrequency: frequency * 1.9, duration: 0.09, volume: 0.11, type: "triangle" },
  ]);
export const playSingingBowl = () =>
  playVoices(
    [432, 648, 864].map((frequency, index) => ({
      frequency,
      duration: 2.2,
      volume: 0.07 / (index + 1),
    })),
  );
