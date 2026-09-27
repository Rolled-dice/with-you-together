import { useCallback, useEffect, useRef, useState } from "react";

export type SoftphoneStatus =
  | "idle"
  | "connecting"
  | "registered"
  | "ringing"
  | "on_call"
  | "error";

/**
 * Browser softphone for agents. Registers with Telnyx WebRTC using a
 * short-lived token minted server-side, auto-answers the leg our call flow
 * dials to this credential, and exposes mute / hold / hangup.
 *
 * The SDK is imported dynamically so it never runs during SSR.
 */
/** Public ringback asset, looped while the member is being dialled. */
const RINGBACK_SRC = "/sounds/ringback.mp3";

/**
 * Ringback player used while the member is being dialled. Primary source is the
 * looping asset at public/sounds/ringback.mp3; if that can't load or the
 * browser blocks playback, it falls back to a synthesised dual-frequency ring
 * (440 + 480 Hz, classic cadence) so the agent always hears *something*.
 * One instance per softphone; start()/stop() are idempotent.
 */
function createRingtone() {
  let stopped = true;

  // --- File-based ringback ---
  let el: HTMLAudioElement | null = null;

  // --- Synth fallback ---
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function ringBurst(duration = 1.8) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
    master.gain.setValueAtTime(0.18, t0 + duration - 0.08);
    master.gain.linearRampToValueAtTime(0, t0 + duration);
    master.connect(ctx.destination);
    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(master);
      osc.start(t0);
      osc.stop(t0 + duration);
    }
  }

  function startSynth() {
    if (stopped || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      void ctx.resume?.();
    } catch {
      ctx = null;
      return;
    }
    ringBurst();
    timer = setInterval(() => ringBurst(), 6000);
  }

  function stopSynth() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (ctx) {
      const dead = ctx;
      ctx = null;
      void dead.close?.().catch(() => {});
    }
  }

  return {
    get active() {
      return !stopped;
    },
    start() {
      if (!stopped) return;
      if (typeof window === "undefined") return;
      stopped = false;
      try {
        el = new Audio(RINGBACK_SRC);
        el.loop = true;
        el.volume = 0.7;
        // If the file plays, use it. If it's blocked or missing, fall back.
        el.play().catch(() => {
          el = null;
          startSynth();
        });
      } catch {
        el = null;
        startSynth();
      }
    },
    stop() {
      stopped = true;
      if (el) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        el = null;
      }
      stopSynth();
    },
  };
}

export function useSoftphone(getToken: () => Promise<{ token: string }>) {
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  if (!ringtoneRef.current) ringtoneRef.current = createRingtone();
  const [status, setStatusState] = useState<SoftphoneStatus>("idle");
  const statusRef = useRef<SoftphoneStatus>("idle");
  const errorRef = useRef<string | null>(null);
  const setStatus = useCallback((next: SoftphoneStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== "on_call") return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Watches the remote audio element and stops the ringback once the member's
  // audio actually starts flowing (i.e. they answered and the legs bridged).
  // Uses a Web Audio analyser on the remote MediaStream to detect real signal;
  // falls back to a hard cap so the ring can never loop forever.
  const audioWatchRef = useRef<{
    raf: number | null;
    ac: AudioContext | null;
    cap: ReturnType<typeof setTimeout> | null;
  }>({ raf: null, ac: null, cap: null });

  const stopRemoteAudioWatch = useCallback(() => {
    const w = audioWatchRef.current;
    if (w.raf != null) cancelAnimationFrame(w.raf);
    if (w.cap) clearTimeout(w.cap);
    if (w.ac) void w.ac.close?.().catch(() => {});
    audioWatchRef.current = { raf: null, ac: null, cap: null };
  }, []);

  const startRemoteAudioWatch = useCallback(() => {
    stopRemoteAudioWatch();
    const el = audioRef.current;
    const stream = (el?.srcObject as MediaStream | null) ?? null;
    // Safety cap: never ring longer than 45s even if detection fails.
    const cap = setTimeout(() => ringtoneRef.current?.stop(), 45_000);
    audioWatchRef.current.cap = cap;

    if (!stream || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    let ac: AudioContext;
    try {
      ac = new AC();
    } catch {
      return;
    }
    audioWatchRef.current.ac = ac;
    const source = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      // Deviation from the 128 midpoint = actual audio energy from the member.
      let peak = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const d = Math.abs(buf[i] - 128);
        if (d > peak) peak = d;
      }
      if (peak > 4) {
        // Member audio is flowing — the call is truly connected.
        ringtoneRef.current?.stop();
        stopRemoteAudioWatch();
        return;
      }
      audioWatchRef.current.raf = requestAnimationFrame(tick);
    };
    audioWatchRef.current.raf = requestAnimationFrame(tick);
  }, [stopRemoteAudioWatch]);

  const connect = useCallback(async () => {
    if (clientRef.current) return;
    setError(null);
    setStatus("connecting");
    try {
      // Ask for the microphone BEFORE the SDK enumerates devices. Without an
      // active permission grant browsers hide audio inputs and the SDK fails
      // with "Microphone not found".
      let micId: string | undefined;
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser can't use a microphone here. Open the console in Chrome or Safari over https.",
        );
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        micId = devices.find((d) => d.kind === "audioinput" && d.deviceId)?.deviceId;
      } catch (permErr) {
        const name = (permErr as { name?: string })?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          throw new Error(
            "Microphone blocked. Allow microphone access for this site in your browser, then press Go online again.",
          );
        }
        throw new Error(
          "No microphone found. Plug in or connect your headset, then press Go online again.",
        );
      }

      const { token } = await getToken();
      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({ login_token: token, ...(micId ? { micId } : {}) });
      if (audioRef.current) client.remoteElement = audioRef.current;

      client.on("telnyx.ready", () => setStatus("registered"));
      client.on("telnyx.error", (e: any) => {
        errorRef.current = e?.error?.message ?? "Softphone connection failed";
        setError(errorRef.current);
        setStatus("error");
      });
      client.on("telnyx.notification", (notification: any) => {
        if (notification.type !== "callUpdate" || !notification.call) return;
        const call = notification.call;
        callRef.current = call;
        switch (call.state) {
          case "ringing":
            setStatus("ringing");
            // Auto-answer the agent leg immediately; the ringback keeps playing
            // to signal "calling the member" until their audio actually flows.
            void call.answer();
            break;
          case "active":
            // The agent leg is up, but the member has NOT answered yet — the
            // two legs are only bridged (and audio only starts) once the member
            // picks up. Ring until we detect that remote audio.
            setStatus("on_call");
            ringtoneRef.current?.start();
            startRemoteAudioWatch();
            break;
          case "hangup":
          case "destroy":
            ringtoneRef.current?.stop();
            stopRemoteAudioWatch();
            callRef.current = null;
            setMuted(false);
            setHeld(false);
            setStatus("registered");
            break;
          default:
            break;
        }
      });

      clientRef.current = client;
      await client.connect();
    } catch (e) {
      clientRef.current = null;
      errorRef.current = e instanceof Error ? e.message : "Could not start the softphone";
      setError(errorRef.current);
      setStatus("error");
    }
  }, [getToken]);

  /**
   * Connects if needed and resolves only once Telnyx has actually registered
   * the browser leg. Dialling before this point makes the agent leg fail with
   * `user_busy`, because there is no endpoint to ring yet.
   */
  const ensureRegistered = useCallback(
    async (timeoutMs = 15_000) => {
      if (statusRef.current === "registered" || statusRef.current === "on_call") return;
      errorRef.current = null;
      await connect();
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const current = String(statusRef.current);
        if (current === "registered" || current === "on_call") return;

        if (current === "error") {
          throw new Error(errorRef.current ?? "Softphone could not connect");
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      throw new Error("Your browser phone did not come online, check the microphone permission and try again.");
    },
    [connect],
  );

  const disconnect = useCallback(async (updateStatus = true) => {
    ringtoneRef.current?.stop();
    stopRemoteAudioWatch();
    try {
      await callRef.current?.hangup();
    } catch {
      /* ignore */
    }
    try {
      await clientRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    clientRef.current = null;
    callRef.current = null;
    if (updateStatus) setStatus("idle");
  }, []);

  useEffect(() => () => void disconnect(false), [disconnect]);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    if (muted) call.unmuteAudio();
    else call.muteAudio();
    setMuted(!muted);
  }, [muted]);

  const toggleHold = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    if (held) await call.unhold();
    else await call.hold();
    setHeld(!held);
  }, [held]);

  const hangup = useCallback(async () => {
    ringtoneRef.current?.stop();
    stopRemoteAudioWatch();
    try {
      await callRef.current?.hangup();
    } catch {
      /* ignore */
    }
  }, [stopRemoteAudioWatch]);

  const sendDigit = useCallback((digit: string) => {
    callRef.current?.dtmf(digit);
  }, []);

  return {
    status,
    error,
    muted,
    held,
    seconds,
    audioRef,
    connect,
    ensureRegistered,
    disconnect,
    toggleMute,
    toggleHold,
    hangup,
    sendDigit,
  };
}
