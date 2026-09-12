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
export function useSoftphone(getToken: () => Promise<{ token: string }>) {
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const connect = useCallback(async () => {
    if (clientRef.current) return;
    setError(null);
    setStatus("connecting");
    try {
      const { token } = await getToken();
      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({ login_token: token });
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
            void call.answer();
            break;
          case "active":
            setStatus("on_call");
            break;
          case "hangup":
          case "destroy":
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
      setError(e instanceof Error ? e.message : "Could not start the softphone");
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
        if (statusRef.current === "registered" || statusRef.current === "on_call") return;
        if (statusRef.current === "error") {
          throw new Error(errorRef.current ?? "Softphone could not connect");
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("Your browser phone did not come online — check the microphone permission and try again.");
    },
    [connect],
  );

  const disconnect = useCallback(async () => {
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
    setStatus("idle");
  }, []);

  useEffect(() => () => void disconnect(), [disconnect]);

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
    try {
      await callRef.current?.hangup();
    } catch {
      /* ignore */
    }
  }, []);

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
