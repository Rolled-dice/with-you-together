import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Amazon Chime SDK meeting hook.
 *
 * NOTE: the production BesideU call flow currently runs on LiveKit
 * (see src/routes/_authenticated/call.$bookingId.tsx). This hook is the
 * Chime path and is wired to mock credentials until the AWS backend exists.
 */

export type ChimeDevice = { deviceId: string; label: string };

export type ChimeTokens = {
  Meeting: Record<string, unknown>;
  Attendee: Record<string, unknown>;
};

// TODO: Replace with actual API call to AWS ECS backend.
// Returns a hardcoded, fake meeting/attendee pair so the UI can render and be
// exercised locally without an AWS control plane. Joining a real media session
// with these values will fail by design — the SDK is initialized, not connected.
export async function fetchChimeTokens(
  bookingId = "mock-booking",
): Promise<ChimeTokens> {
  await new Promise((r) => setTimeout(r, 150));
  return {
    Meeting: {
      MeetingId: `00000000-0000-4000-8000-${bookingId.slice(0, 12).padEnd(12, "0")}`,
      ExternalMeetingId: `besideu-${bookingId}`,
      MediaRegion: "us-east-1",
      MediaPlacement: {
        AudioHostUrl: "mock.m3.ue1.app.chime.aws:3478",
        AudioFallbackUrl: "wss://haxrp.m3.ue1.app.chime.aws:443/calls/mock",
        SignalingUrl: "wss://signal.m3.ue1.app.chime.aws/control/mock",
        TurnControlUrl: "https://mock.m3.ue1.app.chime.aws/v2/turn_sessions",
        ScreenDataUrl: "wss://bitpw.m3.ue1.app.chime.aws:443/v2/screen/mock",
        ScreenViewingUrl: "wss://bitpw.m3.ue1.app.chime.aws:443/ws/connect",
        ScreenSharingUrl: "wss://bitpw.m3.ue1.app.chime.aws:443/v2/screen/mock",
        EventIngestionUrl: "https://data.svc.ue1.ingest.chime.aws/v1/client-events",
      },
    },
    Attendee: {
      ExternalUserId: `besideu-user-${bookingId}`,
      AttendeeId: "mock-attendee-id",
      JoinToken: "mock-join-token-not-valid",
    },
  };
}

type Status = "idle" | "initializing" | "ready" | "in-call" | "error";

export type ChatMessage = {
  id: string;
  kind: "text" | "system";
  body: string;
  senderRole: "user" | "listener" | "system";
  self: boolean;
  at: number;
};

const CHAT_TOPIC = "besideu-chat";

export function useChimeMeeting(
  bookingId = "mock-booking",
  selfRole: "user" | "listener" = "user",
) {

  const sessionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [volume, setVolume] = useState(0);

  const [audioInputs, setAudioInputs] = useState<ChimeDevice[]>([]);
  const [videoInputs, setVideoInputs] = useState<ChimeDevice[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");

  /** Create the MeetingSession from (mock) credentials. Browser-only. */
  const initialize = useCallback(async () => {
    if (typeof window === "undefined" || sessionRef.current) return;
    setStatus("initializing");
    setError(null);
    try {
      const {
        ConsoleLogger,
        DefaultDeviceController,
        DefaultMeetingSession,
        LogLevel,
        MeetingSessionConfiguration,
      } = await import("amazon-chime-sdk-js");

      const tokens = await fetchChimeTokens(bookingId);
      const logger = new ConsoleLogger("BesideUChime", LogLevel.WARN);
      const deviceController = new DefaultDeviceController(logger);
      const configuration = new MeetingSessionConfiguration(
        tokens.Meeting,
        tokens.Attendee,
      );
      const session = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController,
      );
      sessionRef.current = session;

      const mics = await session.audioVideo.listAudioInputDevices();
      const cams = await session.audioVideo.listVideoInputDevices();
      setAudioInputs(
        mics.map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        })),
      );
      setVideoInputs(
        cams.map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        })),
      );
      if (mics[0]) setSelectedAudioInput(mics[0].deviceId);
      if (cams[0]) setSelectedVideoInput(cams[0].deviceId);
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, [bookingId]);

  /** Local volume meter driven by the SDK's analyser node. */
  const startVolumeMeter = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const analyser = session.audioVideo.createAnalyserNodeForAudioInput?.();
    if (!analyser) return;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) {
        peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
      }
      setVolume((prev) => prev * 0.7 + peak * 0.3);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopVolumeMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    setVolume(0);
  }, []);

  const chooseAudioInputDevice = useCallback(async (deviceId: string) => {
    const session = sessionRef.current;
    setSelectedAudioInput(deviceId);
    if (!session) return;
    try {
      await session.audioVideo.startAudioInput(deviceId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const chooseVideoInputDevice = useCallback(async (deviceId: string) => {
    const session = sessionRef.current;
    setSelectedVideoInput(deviceId);
    if (!session) return;
    try {
      await session.audioVideo.startVideoInput(deviceId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const startCall = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    setError(null);
    try {
      const observer = {
        videoTileDidUpdate: (tile: any) => {
          if (!tile.boundAttendeeId) return;
          const el = tile.localTile ? localVideoRef.current : remoteVideoRef.current;
          if (el) session.audioVideo.bindVideoElement(tile.tileId, el);
        },
        videoTileWasRemoved: () => {},
        audioVideoDidStop: () => setStatus("ready"),
      };
      session.audioVideo.addObserver(observer);

      if (selectedAudioInput)
        await session.audioVideo.startAudioInput(selectedAudioInput);
      if (selectedVideoInput && cameraOn)
        await session.audioVideo.startVideoInput(selectedVideoInput);
      if (audioElRef.current)
        await session.audioVideo.bindAudioElement(audioElRef.current);

      session.audioVideo.start();
      if (cameraOn) session.audioVideo.startLocalVideoTile();
      startVolumeMeter();
      setStatus("in-call");
    } catch (e) {
      // Expected while the mock backend is in place: media servers are fake.
      setError((e as Error).message);
      setStatus("error");
    }
  }, [cameraOn, selectedAudioInput, selectedVideoInput, startVolumeMeter]);

  const muteMic = useCallback(() => {
    sessionRef.current?.audioVideo.realtimeMuteLocalAudio();
    setMuted(true);
  }, []);

  const unmuteMic = useCallback(() => {
    sessionRef.current?.audioVideo.realtimeUnmuteLocalAudio();
    setMuted(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    const session = sessionRef.current;
    const next = !cameraOn;
    setCameraOn(next);
    if (!session) return;
    try {
      if (next) {
        if (selectedVideoInput)
          await session.audioVideo.startVideoInput(selectedVideoInput);
        session.audioVideo.startLocalVideoTile();
      } else {
        session.audioVideo.stopLocalVideoTile();
        await session.audioVideo.stopVideoInput();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [cameraOn, selectedVideoInput]);

  const leaveCall = useCallback(async () => {
    const session = sessionRef.current;
    stopVolumeMeter();
    if (!session) return;
    try {
      session.audioVideo.stopLocalVideoTile();
      await session.audioVideo.stopVideoInput();
      await session.audioVideo.stopAudioInput();
      session.audioVideo.stop();
    } catch {
      // best effort teardown
    }
    sessionRef.current = null;
    setStatus("idle");
  }, [stopVolumeMeter]);

  useEffect(() => {
    return () => {
      stopVolumeMeter();
      try {
        sessionRef.current?.audioVideo.stop();
      } catch {
        // ignore
      }
      sessionRef.current = null;
    };
  }, [stopVolumeMeter]);

  return {
    status,
    error,
    muted,
    cameraOn,
    volume,
    audioInputs,
    videoInputs,
    selectedAudioInput,
    selectedVideoInput,
    localVideoRef,
    remoteVideoRef,
    audioElRef,
    initialize,
    chooseAudioInputDevice,
    chooseVideoInputDevice,
    startCall,
    muteMic,
    unmuteMic,
    toggleCamera,
    leaveCall,
  };
}

export type ChimeMeeting = ReturnType<typeof useChimeMeeting>;
