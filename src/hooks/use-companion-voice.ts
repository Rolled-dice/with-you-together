import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_VOICE_BYTES,
  MAX_VOICE_SECONDS,
  VoiceTranscriptionError,
  type VoiceLanguage,
} from "@/lib/companion-voice";

export interface VoiceRecognitionResult {
  isFinal: boolean;
  readonly [index: number]: { transcript: string };
}
export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult:
    ((event: { resultIndex: number; results: ArrayLike<VoiceRecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => VoiceRecognition;
    webkitSpeechRecognition?: new () => VoiceRecognition;
  }
}

type VoiceState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "listening"; mode: "live" | "recording" }
  | { kind: "finishing" }
  | { kind: "transcribing" }
  | { kind: "error"; message: string; retryable: boolean };

const recordingTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
];

export function useCompanionVoice({
  language,
  disabled,
  onTranscript,
  transcribe,
}: {
  language: VoiceLanguage;
  disabled: boolean;
  onTranscript: (text: string) => void;
  transcribe: (audio: Blob, language: VoiceLanguage, signal: AbortSignal) => Promise<string>;
}) {
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const [available, setAvailable] = useState(false);
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const callbacks = useRef({ onTranscript, transcribe });
  const mounted = useRef(false);
  const generation = useRef(0);
  const active = useRef(false);
  const wanted = useRef(false);
  const preferRecording = useRef(false);
  const recognition = useRef<VoiceRecognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const retryAudio = useRef<{ audio: Blob; language: VoiceLanguage } | null>(null);
  const interimRef = useRef("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    callbacks.current = { onTranscript, transcribe };
  }, [onTranscript, transcribe]);

  const release = useCallback(() => {
    generation.current += 1;
    active.current = false;
    wanted.current = false;
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    if (clock.current) clearInterval(clock.current);
    clock.current = null;
    const live = recognition.current;
    recognition.current = null;
    if (live) {
      live.onstart = live.onresult = live.onerror = live.onend = null;
      try {
        live.abort();
      } catch {
        /* Already ended. */
      }
    }
    const recording = recorder.current;
    recorder.current = null;
    if (recording) {
      recording.onstop = recording.ondataavailable = recording.onerror = null;
      if (recording.state !== "inactive") recording.stop();
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    controller.current?.abort();
    controller.current = null;
    interimRef.current = "";
  }, []);

  const fail = useCallback(
    (message: string, retryable = false) => {
      release();
      if (!retryable) retryAudio.current = null;
      if (!mounted.current) return;
      setInterim("");
      setState({ kind: "error", message, retryable });
    },
    [release],
  );

  const cancel = useCallback(() => {
    release();
    retryAudio.current = null;
    if (mounted.current) {
      setInterim("");
      setState({ kind: "idle" });
    }
  }, [release]);

  const finishLive = useCallback(() => {
    // Some browsers end with an interim result instead of a final result.
    const remaining = interimRef.current.trim();
    if (remaining) callbacks.current.onTranscript(remaining);
    cancel();
  }, [cancel]);

  const stop = useCallback(() => {
    wanted.current = false;
    if (recognition.current) {
      setState({ kind: "finishing" });
      const id = generation.current;
      timers.current.push(
        setTimeout(() => {
          if (generation.current === id) finishLive();
        }, 1800),
      );
      try {
        recognition.current.stop();
      } catch {
        finishLive();
      }
    } else if (recorder.current?.state === "recording") {
      setState({ kind: "finishing" });
      recorder.current.stop();
      // Release the microphone immediately, not after upload/transcription.
      stream.current?.getTracks().forEach((track) => track.stop());
    } else {
      cancel();
    }
  }, [cancel, finishLive]);

  const runTranscription = useCallback(
    async (audio: Blob, chosenLanguage: VoiceLanguage) => {
      release();
      const id = generation.current;
      const abort = new AbortController();
      controller.current = abort;
      retryAudio.current = { audio, language: chosenLanguage };
      active.current = true;
      setState({ kind: "transcribing" });
      try {
        const text = await callbacks.current.transcribe(audio, chosenLanguage, abort.signal);
        if (!mounted.current || generation.current !== id) return;
        if (!text.trim()) {
          throw new VoiceTranscriptionError(
            "No clear speech was heard. Please record again.",
            false,
          );
        }
        callbacks.current.onTranscript(text);
        cancel();
      } catch (error) {
        if (!mounted.current || generation.current !== id) return;
        fail(
          error instanceof Error
            ? error.message
            : "Voice input could not finish. Please try again.",
          error instanceof VoiceTranscriptionError ? error.retryable : true,
        );
      }
    },
    [cancel, fail, release],
  );

  const start = useCallback(async () => {
    if (disabled || active.current || document.visibilityState === "hidden") return;
    release();
    retryAudio.current = null;
    const id = generation.current;
    active.current = true;
    wanted.current = true;
    setInterim("");
    setElapsed(0);
    setState({ kind: "starting" });
    let started = false;
    const startClock = () => {
      if (started) return;
      started = true;
      const since = Date.now();
      clock.current = setInterval(() => setElapsed(Math.floor((Date.now() - since) / 1000)), 1000);
      timers.current.push(setTimeout(stop, MAX_VOICE_SECONDS * 1000));
    };
    const NativeRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (NativeRecognition && !preferRecording.current) {
      const live = new NativeRecognition();
      recognition.current = live;
      live.lang = language;
      live.continuous = true;
      live.interimResults = true;
      live.maxAlternatives = 1;
      const finalized = new Set<number>();
      let noSpeech = 0;
      live.onstart = () => {
        if (generation.current !== id) return;
        startClock();
        setState({ kind: "listening", mode: "live" });
      };
      live.onresult = (event) => {
        if (generation.current !== id) return;
        noSpeech = 0;
        const complete: string[] = [];
        const partial: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            if (!finalized.has(i)) {
              complete.push(text);
              finalized.add(i);
            }
          } else {
            partial.push(text);
          }
        }
        interimRef.current = partial.join(" ").trim();
        setInterim(interimRef.current);
        if (complete.length) callbacks.current.onTranscript(complete.join(" "));
      };
      live.onerror = (event) => {
        if (generation.current !== id) return;
        if (event.error === "no-speech") {
          noSpeech += 1;
          return;
        }
        if (event.error === "aborted" && !wanted.current) return;
        if (event.error === "not-allowed") {
          fail(
            "Microphone access was denied. Allow microphone access in your browser settings, or type your message.",
          );
        } else if (event.error === "audio-capture") {
          fail(
            "No microphone was found. Check that it is connected and not in use by another app.",
          );
        } else {
          preferRecording.current = true;
          fail(
            "Live voice input is unavailable. Tap the microphone to try a recording instead, or type your message.",
          );
        }
      };
      live.onend = () => {
        if (generation.current !== id) return;
        if (!wanted.current) {
          finishLive();
          return;
        }
        if (noSpeech >= 3) {
          fail("No clear speech was heard. Tap the microphone to try again.");
          return;
        }
        const remaining = interimRef.current.trim();
        if (remaining) callbacks.current.onTranscript(remaining);
        interimRef.current = "";
        setInterim("");
        finalized.clear();
        // Continue across browser-imposed pauses without making the user tap again.
        timers.current.push(
          setTimeout(() => {
            if (generation.current !== id || !wanted.current) return;
            try {
              live.start();
            } catch {
              preferRecording.current = true;
              fail("Live voice input stopped. Tap the microphone to try a recording instead.");
            }
          }, 250),
        );
      };
      timers.current.push(
        setTimeout(() => {
          if (!started && generation.current === id)
            fail("The microphone did not start. Please try again, or type your message.");
        }, 20000),
      );
      try {
        live.start();
      } catch {
        preferRecording.current = true;
        fail("Live voice input could not start. Tap the microphone to try a recording instead.");
      }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      fail("Voice input is not supported in this browser. You can still type your message.");
      return;
    }
    timers.current.push(
      setTimeout(() => {
        if (!started && generation.current === id)
          fail("Microphone access is still waiting. Please try again when you are ready.");
      }, 20000),
    );
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (!mounted.current || generation.current !== id) {
        audioStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = audioStream;
      const mimeType = recordingTypes.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) {
        fail(
          "This browser cannot record a supported audio format. Please use another browser or type your message.",
        );
        return;
      }
      const recording = new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: 32000 });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let size = 0;
      recording.ondataavailable = (event) => {
        if (generation.current !== id || !event.data.size) return;
        size += event.data.size;
        if (size > MAX_VOICE_BYTES) {
          fail("The recording is too large. Please record a shorter message.");
          return;
        }
        chunks.push(event.data);
      };
      recording.onerror = () =>
        fail("The microphone stopped working. Please try again, or type your message.");
      recording.onstop = () => {
        if (generation.current !== id) return;
        const audio = new Blob(chunks, { type: recording.mimeType });
        if (!audio.size) {
          fail("No audio was recorded. Please try again.");
          return;
        }
        void runTranscription(audio, language);
      };
      audioStream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (wanted.current && generation.current === id) stop();
        };
      });
      recording.start(250);
      startClock();
      setState({ kind: "listening", mode: "recording" });
    } catch (error) {
      if (generation.current !== id) return;
      fail(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser settings, or type your message."
          : "Could not access the microphone. Check that it is connected and not in use by another app.",
      );
    }
  }, [disabled, fail, finishLive, language, release, runTranscription, stop]);

  const retry = useCallback(() => {
    const saved = retryAudio.current;
    if (saved && !disabled && !active.current) void runTranscription(saved.audio, saved.language);
  }, [disabled, runTranscription]);

  useEffect(() => {
    mounted.current = true;
    setAvailable(
      window.isSecureContext &&
        !!(
          window.SpeechRecognition ||
          window.webkitSpeechRecognition ||
          (typeof navigator.mediaDevices?.getUserMedia === "function" &&
            typeof MediaRecorder !== "undefined")
        ),
    );
    const hide = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", cancel);
    return () => {
      mounted.current = false;
      release();
      retryAudio.current = null;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", cancel);
    };
  }, [cancel, release]);

  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);

  const isActive =
    state.kind === "starting" ||
    state.kind === "listening" ||
    state.kind === "finishing" ||
    state.kind === "transcribing";
  return { state, available, interim, elapsed, isActive, start, stop, cancel, retry };
}
