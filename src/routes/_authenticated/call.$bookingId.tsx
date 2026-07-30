import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  endCall,
  getCallState,
  getCallToken,
  refreshCallToken,
  setReady,
  setRecordingConsent,
  submitSessionFeedback,
} from "@/lib/call.functions";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Loader2,
  ShieldCheck,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { CallChatPanel } from "@/components/call-chat-panel";

import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure } from "livekit-client";
import "@livekit/components-styles";

type DeviceState = {
  checking: boolean;
  hasMic: boolean;
  hasCam: boolean;
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  camPermission: "granted" | "denied" | "prompt" | "unknown";
  error?: string;
};

async function probeDevices(): Promise<DeviceState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return {
      checking: false,
      hasMic: false,
      hasCam: false,
      micPermission: "unknown",
      camPermission: "unknown",
      error: "This browser doesn't support camera or microphone access.",
    };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasMic = devices.some((d) => d.kind === "audioinput");
    const hasCam = devices.some((d) => d.kind === "videoinput");

    async function perm(name: "microphone" | "camera") {
      try {
        // Permissions API is best-effort; not all browsers support these names.
        const p = await (
          navigator.permissions as Permissions & {
            query: (d: { name: string }) => Promise<PermissionStatus>;
          }
        ).query({ name });
        return p.state as "granted" | "denied" | "prompt";
      } catch {
        return "unknown" as const;
      }
    }
    const [micPermission, camPermission] = await Promise.all([
      perm("microphone"),
      perm("camera"),
    ]);
    return {
      checking: false,
      hasMic,
      hasCam,
      micPermission,
      camPermission,
    };
  } catch (e) {
    return {
      checking: false,
      hasMic: false,
      hasCam: false,
      micPermission: "unknown",
      camPermission: "unknown",
      error: (e as Error).message,
    };
  }
}

export const Route = createFileRoute("/_authenticated/call/$bookingId")({
  head: () => ({
    meta: [
      { title: "Session — BesideU" },
      { name: "description", content: "Your private BesideU session room." },
    ],
  }),
  component: CallPage,
});

function CallPage() {
  const { bookingId } = Route.useParams();
  const qc = useQueryClient();
  const stateFn = useServerFn(getCallState);
  const readyFn = useServerFn(setReady);
  const consentFn = useServerFn(setRecordingConsent);
  const tokenFn = useServerFn(getCallToken);
  const refreshFn = useServerFn(refreshCallToken);
  const endFn = useServerFn(endCall);

  const [role, setRole] = useState<"user" | "listener">("user");
  type Session = {
    token: string;
    url: string;
    room: string;
    expiresAt: number;
  };
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const endedByUserRef = useRef(false);
  const recoveringRef = useRef(false);

  const [devices, setDevices] = useState<DeviceState>({
    checking: true,
    hasMic: false,
    hasCam: false,
    micPermission: "unknown",
    camPermission: "unknown",
  });
  const [mediaMode, setMediaMode] = useState<"video" | "audio" | "none">(
    "video",
  );

  const runProbe = async () => {
    setDevices((d) => ({ ...d, checking: true }));
    const next = await probeDevices();
    setDevices(next);
    // Auto-select a sane default: video needs cam+mic; audio needs mic.
    setMediaMode((prev) => {
      if (prev === "video" && (!next.hasCam || next.camPermission === "denied"))
        return next.hasMic && next.micPermission !== "denied" ? "audio" : "none";
      if (prev === "audio" && (!next.hasMic || next.micPermission === "denied"))
        return "none";
      return prev;
    });
  };

  useEffect(() => {
    void runProbe();
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      const handler = () => void runProbe();
      navigator.mediaDevices.addEventListener("devicechange", handler);
      return () =>
        navigator.mediaDevices.removeEventListener("devicechange", handler);
    }
  }, []);

  async function requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // Try audio-only if video was the blocker.
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        audioOnly.getTracks().forEach((t) => t.stop());
      } catch (e) {
        toast.error(friendlyLiveKitError(e));
      }
    }
    await runProbe();
  }


  const { data: booking, isLoading } = useQuery({
    queryKey: ["call-state", bookingId],
    queryFn: () => stateFn({ data: { booking_id: bookingId } }),
    refetchInterval: session ? false : 3000,
  });

  const readyMut = useMutation({
    mutationFn: (ready: boolean) =>
      readyFn({ data: { booking_id: bookingId, role, ready } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-state", bookingId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const consentMut = useMutation({
    mutationFn: (consent: boolean) =>
      consentFn({ data: { booking_id: bookingId, role, consent } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-state", bookingId] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const joinMut = useMutation({
    mutationFn: () => tokenFn({ data: { booking_id: bookingId, role } }),
    onSuccess: (s) => {
      endedByUserRef.current = false;
      setSession({
        token: s.token,
        url: s.url,
        room: s.room,
        expiresAt: s.expiresAt,
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const endMut = useMutation({
    mutationFn: () => endFn({ data: { booking_id: bookingId } }),
    onSuccess: () => {
      endedByUserRef.current = true;
      setSession(null);
      qc.invalidateQueries({ queryKey: ["call-state", bookingId] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Session ended");
    },
  });

  // Proactive token refresh: refresh 2 minutes before expiry.
  useEffect(() => {
    if (!session) return;
    const msUntilRefresh = Math.max(
      5_000,
      session.expiresAt - Date.now() - 2 * 60_000,
    );
    const t = setTimeout(async () => {
      try {
        const s = await refreshFn({
          data: { booking_id: bookingId, role },
        });
        setSession((prev) =>
          prev
            ? { ...prev, token: s.token, expiresAt: s.expiresAt }
            : prev,
        );
        toast.success("Session pass renewed", { id: "lk-refresh" });
      } catch (e) {
        toast.error(
          "Couldn't renew your session pass. If you get disconnected we'll try to reconnect.",
          { id: "lk-refresh" },
        );
        console.error("token refresh failed", e);
      }
    }, msUntilRefresh);
    return () => clearTimeout(t);
  }, [session, bookingId, role, refreshFn]);

  async function handleUnexpectedDisconnect() {
    if (endedByUserRef.current) {
      setSession(null);
      return;
    }
    if (recoveringRef.current) return;
    recoveringRef.current = true;
    const prev = sessionRef.current;
    setSession(null);
    toast.loading("Reconnecting your session…", { id: "lk-recover" });
    try {
      const s = await refreshFn({
        data: { booking_id: bookingId, role },
      });
      setSession({
        token: s.token,
        url: s.url,
        room: s.room,
        expiresAt: s.expiresAt,
      });
      toast.success("Reconnected", { id: "lk-recover" });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(
        /ended/i.test(msg)
          ? "This session has ended."
          : "We couldn't reconnect. Please rejoin when you're ready.",
        { id: "lk-recover" },
      );
      console.error("auto-recover failed", e, "prev room:", prev?.room);
    } finally {
      recoveringRef.current = false;
    }
  }

  if (session) {
    const wantVideo = mediaMode === "video" && devices.hasCam;
    const wantAudio = mediaMode !== "none" && devices.hasMic;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <LiveKitRoom
          key={session.room}
          serverUrl={session.url}
          token={session.token}
          video={wantVideo}
          audio={wantAudio}
          data-lk-theme="default"
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
          onDisconnected={() => {
            void handleUnexpectedDisconnect();
          }}
          onError={(e) =>
            toast.error(friendlyLiveKitError(e), { id: "lk-error" })
          }
          onMediaDeviceFailure={(failure) => {
            const map: Record<string, string> = {
              [MediaDeviceFailure.PermissionDenied]:
                "Camera or microphone access was blocked. Update your browser permissions and try again.",
              [MediaDeviceFailure.NotFound]:
                "We couldn't find a working camera or microphone. Joining without it.",
              [MediaDeviceFailure.DeviceInUse]:
                "Your camera or microphone is being used by another app. Close it and try again.",
              [MediaDeviceFailure.Other]:
                "We couldn't access your camera or microphone.",
            };
            toast.error(map[failure ?? ""] ?? map[MediaDeviceFailure.Other], {
              id: "lk-device",
            });
            void runProbe();
          }}
        >
          <CallHeader
            room={session.room}
            onLeave={() => endMut.mutate()}
            leaving={endMut.isPending}
          />
          <DeviceModeStrip
            mode={mediaMode}
            devices={devices}
            onChange={setMediaMode}
          />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="relative min-h-0 flex-1">
              <VideoConference />
              <RoomAudioRenderer />
              <Button
                size="sm"
                variant="secondary"
                className="absolute right-3 top-3 z-10 shadow-md md:hidden"
                onClick={() => setChatOpen(true)}
              >
                <MessageCircle className="mr-1.5 h-4 w-4" /> Chat
              </Button>
            </div>
            {/* Desktop: side-by-side chat sidebar */}
            <aside className="hidden w-[340px] shrink-0 border-l border-border md:block">
              <CallChatPanel role={role} />
            </aside>
          </div>
          {/* Mobile: bottom drawer chat */}
          <Drawer open={chatOpen} onOpenChange={setChatOpen}>
            <DrawerContent className="h-[80vh] md:hidden">
              <div className="min-h-0 flex-1 overflow-hidden">
                <CallChatPanel role={role} onClose={() => setChatOpen(false)} />
              </div>
            </DrawerContent>
          </Drawer>

        </LiveKitRoom>
      </div>
    );
  }

  const readyBoth = booking?.ready_user && booking?.ready_listener;
  const consentBoth =
    booking?.recording_consent_user && booking?.recording_consent_listener;
  const listenerName =
    (booking as { listeners?: { name?: string } } | undefined)?.listeners?.name ??
    "Listener";

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          to="/listeners"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Listeners
        </Link>
      </div>
      <PageHeader
        eyebrow="Session"
        title={`With ${listenerName}`}
        description="A private, encrypted room. Both of you confirm you're ready before it opens."
      />

      {isLoading || !booking ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-brand" />
          <Skeleton className="h-40 rounded-brand" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full capitalize">
              {booking.status}
            </Badge>
            <span>
              {new Date(booking.requested_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}
              {booking.duration_minutes} min
            </span>
          </div>

          {booking.call_ended_at ? (
            <SessionFeedbackCard
              bookingId={bookingId}
              alreadyRated={Boolean(booking.feedback_at)}
              existingRating={booking.rating ?? null}
              existingNote={booking.feedback_note ?? ""}
              followUpWanted={Boolean(booking.follow_up_wanted)}
            />
          ) : (
          <>
          <Card className="mb-4 rounded-brand border-border bg-card">

            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">I'm joining as</div>
                  <div className="text-xs text-muted-foreground">
                    Switch to test both perspectives on this device.
                  </div>
                </div>
                <div className="inline-flex rounded-brand border border-border p-0.5">
                  {(["user", "listener"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`rounded-brand px-3 py-1 text-xs capitalize ${
                        role === r
                          ? "bg-brand-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r === "user" ? "Me" : "Listener"}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-brand border-border bg-card">
              <CardContent className="flex flex-col gap-4 p-5">
                <div>
                  <h3 className="text-base font-medium">Ready check</h3>
                  <p className="text-xs text-muted-foreground">
                    Both of you signal ready before the room opens.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-brand bg-muted/40 px-3 py-2 text-sm">
                  <span>You (me)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {booking.ready_user ? "Ready" : "Not yet"}
                    </span>
                    <Switch
                      checked={booking.ready_user}
                      onCheckedChange={(v) => {
                        setRole("user");
                        readyMut.mutate(v);
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-brand bg-muted/40 px-3 py-2 text-sm">
                  <span>{listenerName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {booking.ready_listener ? "Ready" : "Not yet"}
                    </span>
                    <Switch
                      checked={booking.ready_listener}
                      onCheckedChange={(v) => {
                        setRole("listener");
                        readyMut.mutate(v);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-brand border-border bg-card">
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-primary" />
                  <div>
                    <h3 className="text-base font-medium">Recording consent</h3>
                    <p className="text-xs text-muted-foreground">
                      BesideU does not record by default. Recording requires both
                      of you to opt in — either can revoke any time.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-brand bg-muted/40 px-3 py-2 text-sm">
                  <Label htmlFor="c-user">I consent to recording</Label>
                  <Switch
                    id="c-user"
                    checked={booking.recording_consent_user}
                    onCheckedChange={(v) => {
                      setRole("user");
                      consentMut.mutate(v);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-brand bg-muted/40 px-3 py-2 text-sm">
                  <Label htmlFor="c-list">{listenerName} consents</Label>
                  <Switch
                    id="c-list"
                    checked={booking.recording_consent_listener}
                    onCheckedChange={(v) => {
                      setRole("listener");
                      consentMut.mutate(v);
                    }}
                  />
                </div>
                <div className="text-xs">
                  Recording status:{" "}
                  <span
                    className={
                      consentBoth
                        ? "font-medium text-brand-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {consentBoth ? "Enabled (both consented)" : "Off"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <DeviceCheckCard
            devices={devices}
            mode={mediaMode}
            onModeChange={setMediaMode}
            onRefresh={runProbe}
            onRequestPermissions={requestPermissions}
          />

          <div className="mt-6 flex flex-col items-center gap-2">
            <Button
              size="lg"
              disabled={
                !readyBoth ||
                joinMut.isPending ||
                devices.checking ||
                (mediaMode !== "none" && !devices.hasMic && !devices.hasCam)
              }
              onClick={() => joinMut.mutate()}
              className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
            >
              {joinMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : mediaMode === "video" ? (
                <Video className="mr-2 h-4 w-4" />
              ) : mediaMode === "audio" ? (
                <Mic className="mr-2 h-4 w-4" />
              ) : (
                <PhoneOff className="mr-2 h-4 w-4" />
              )}
              {readyBoth
                ? mediaMode === "none"
                  ? "Join in listen-only"
                  : `Join as ${role === "user" ? "me" : "listener"}`
                : "Waiting for both ready…"}
            </Button>
            <p className="text-xs text-muted-foreground">
              End-to-end encrypted media. No recordings unless both parties
              opted in above.
            </p>
          </div>
          </>
          )}
        </>

      )}
    </AppShell>
  );
}

function friendlyLiveKitError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("permission") || lower.includes("notallowed"))
    return "Camera or microphone access was blocked. Please allow permissions in your browser and try again.";
  if (lower.includes("notfound") || lower.includes("device"))
    return "We couldn't find a camera or microphone on this device.";
  if (lower.includes("token") || lower.includes("unauthorized") || lower.includes("401"))
    return "Your session pass expired. Please rejoin the room.";
  if (lower.includes("timeout"))
    return "Connection timed out. Check your internet and try again.";
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("ice"))
    return "Network trouble reaching the room. We'll keep trying.";
  return "Something interrupted the call. Please try rejoining.";
}

type StatusMeta = {
  label: string;
  hint: string;
  tone: "info" | "ok" | "warn" | "error";
  icon: typeof Wifi;
  pulse?: boolean;
};

function statusMeta(state: ConnectionState): StatusMeta {
  switch (state) {
    case ConnectionState.Connecting:
      return {
        label: "Joining…",
        hint: "Setting up your secure room.",
        tone: "info",
        icon: Loader2,
        pulse: true,
      };
    case ConnectionState.Connected:
      return {
        label: "Connected",
        hint: "You're live and end-to-end encrypted.",
        tone: "ok",
        icon: CheckCircle2,
      };
    case ConnectionState.Reconnecting:
      return {
        label: "Reconnecting…",
        hint: "Network hiccup — trying to restore the call.",
        tone: "warn",
        icon: Loader2,
        pulse: true,
      };
    case ConnectionState.Disconnected:
      return {
        label: "Disconnected",
        hint: "The call ended or the connection was lost.",
        tone: "error",
        icon: WifiOff,
      };
    default:
      return {
        label: "Preparing…",
        hint: "Getting things ready.",
        tone: "info",
        icon: Wifi,
      };
  }
}

const toneClasses: Record<StatusMeta["tone"], string> = {
  info: "bg-muted text-foreground border-border",
  ok: "bg-brand-primary/10 text-brand-primary border-brand-primary/30",
  warn: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  error: "bg-destructive/10 text-destructive border-destructive/30",
};

function CallHeader({
  room,
  onLeave,
  leaving,
}: {
  room: string;
  onLeave: () => void;
  leaving: boolean;
}) {
  const state = useConnectionState();
  const meta = statusMeta(state);
  const Icon = meta.icon;

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-card/60 px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[meta.tone]}`}
            role="status"
            aria-live="polite"
          >
            <Icon className={`h-3.5 w-3.5 ${meta.pulse ? "animate-spin" : ""}`} />
            {meta.label}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            Room {room}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onLeave}
          disabled={leaving}
        >
          <PhoneOff className="mr-2 h-4 w-4" /> Leave & end
        </Button>
      </div>
      {state !== ConnectionState.Connected && (
        <div
          className={`flex items-start gap-2 rounded-brand border px-3 py-2 text-xs ${toneClasses[meta.tone]}`}
        >
          {meta.tone === "warn" || meta.tone === "error" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{meta.hint}</span>
        </div>
      )}
    </div>
  );
}

type MediaMode = "video" | "audio" | "none";

function DeviceCheckCard({
  devices,
  mode,
  onModeChange,
  onRefresh,
  onRequestPermissions,
}: {
  devices: DeviceState;
  mode: MediaMode;
  onModeChange: (m: MediaMode) => void;
  onRefresh: () => void | Promise<void>;
  onRequestPermissions: () => void | Promise<void>;
}) {
  const micBlocked =
    devices.micPermission === "denied" || (!devices.hasMic && !devices.checking);
  const camBlocked =
    devices.camPermission === "denied" || (!devices.hasCam && !devices.checking);

  const rowClass =
    "flex items-center justify-between gap-3 rounded-brand bg-muted/40 px-3 py-2 text-sm";

  return (
    <Card className="mt-4 rounded-brand border-border bg-card">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-medium">Device check</h3>
            <p className="text-xs text-muted-foreground">
              We only turn on what you allow. You can change this any time.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void onRefresh()}
            disabled={devices.checking}
          >
            {devices.checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className={rowClass}>
          <div className="flex items-center gap-2">
            {devices.hasMic && !micBlocked ? (
              <Mic className="h-4 w-4 text-brand-primary" />
            ) : (
              <MicOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Microphone</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {devices.checking
              ? "Checking…"
              : devices.micPermission === "denied"
                ? "Blocked in browser"
                : !devices.hasMic
                  ? "Not found"
                  : devices.micPermission === "granted"
                    ? "Ready"
                    : "Will ask when joining"}
          </span>
        </div>

        <div className={rowClass}>
          <div className="flex items-center gap-2">
            {devices.hasCam && !camBlocked ? (
              <Video className="h-4 w-4 text-brand-primary" />
            ) : (
              <VideoOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Camera</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {devices.checking
              ? "Checking…"
              : devices.camPermission === "denied"
                ? "Blocked in browser"
                : !devices.hasCam
                  ? "Not found"
                  : devices.camPermission === "granted"
                    ? "Ready"
                    : "Will ask when joining"}
          </span>
        </div>

        {(micBlocked || camBlocked) && (
          <div className="flex items-start gap-2 rounded-brand border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="flex-1">
              {micBlocked && camBlocked
                ? "No working camera or mic detected. You can still join in listen-only mode to hear the other person."
                : camBlocked
                  ? "Camera unavailable. You can join with audio only."
                  : "Microphone unavailable. You can still join in listen-only mode."}
              {(devices.micPermission === "denied" ||
                devices.camPermission === "denied") && (
                <div className="mt-1">
                  If you changed browser permissions, tap Refresh above or{" "}
                  <button
                    className="underline"
                    onClick={() => void onRequestPermissions()}
                  >
                    ask again
                  </button>
                  .
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-xs text-muted-foreground">Join with</div>
          <div className="inline-flex rounded-brand border border-border p-0.5">
            <ModeButton
              active={mode === "video"}
              disabled={!devices.hasCam || camBlocked || !devices.hasMic || micBlocked}
              onClick={() => onModeChange("video")}
              icon={<Video className="h-3.5 w-3.5" />}
              label="Video + audio"
            />
            <ModeButton
              active={mode === "audio"}
              disabled={!devices.hasMic || micBlocked}
              onClick={() => onModeChange("audio")}
              icon={<Mic className="h-3.5 w-3.5" />}
              label="Audio only"
            />
            <ModeButton
              active={mode === "none"}
              onClick={() => onModeChange("none")}
              icon={<MicOff className="h-3.5 w-3.5" />}
              label="Listen only"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-brand px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-brand-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DeviceModeStrip({
  mode,
  devices,
  onChange,
}: {
  mode: MediaMode;
  devices: DeviceState;
  onChange: (m: MediaMode) => void;
}) {
  if (mode === "video" && devices.hasCam && devices.hasMic) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>
          {mode === "none"
            ? "You're in listen-only mode."
            : mode === "audio"
              ? "Joined with audio only (no camera)."
              : "Limited device access."}
        </span>
      </div>
      <div className="inline-flex rounded-brand border border-amber-500/40 p-0.5">
        {devices.hasMic && devices.hasCam && (
          <ModeButton
            active={mode === "video"}
            onClick={() => onChange("video")}
            icon={<Video className="h-3 w-3" />}
            label="Video"
          />
        )}
        {devices.hasMic && (
          <ModeButton
            active={mode === "audio"}
            onClick={() => onChange("audio")}
            icon={<Mic className="h-3 w-3" />}
            label="Audio"
          />
        )}
        <ModeButton
          active={mode === "none"}
          onClick={() => onChange("none")}
          icon={<MicOff className="h-3 w-3" />}
          label="Listen"
        />
      </div>
    </div>
  );
}

function SessionFeedbackCard({
  bookingId,
  alreadyRated,
  existingRating,
  existingNote,
  followUpWanted,
}: {
  bookingId: string;
  alreadyRated: boolean;
  existingRating: number | null;
  existingNote: string;
  followUpWanted: boolean;
}) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitSessionFeedback);
  const [rating, setRating] = useState<number>(existingRating ?? 0);
  const [note, setNote] = useState<string>(existingNote);
  const [followUp, setFollowUp] = useState<boolean>(followUpWanted);
  const [editing, setEditing] = useState<boolean>(!alreadyRated);

  const mut = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          booking_id: bookingId,
          rating: rating || 1,
          note,
          follow_up: followUp,
        },
      }),
    onSuccess: () => {
      toast.success("Thanks for the feedback");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["call-state", bookingId] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (alreadyRated && !editing) {
    return (
      <Card className="rounded-brand border-border bg-card">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium">Your feedback</h3>
              <p className="text-xs text-muted-foreground">
                Session ended · thanks for sharing.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${
                  (existingRating ?? 0) >= n
                    ? "fill-brand-primary text-brand-primary"
                    : "text-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          {existingNote && (
            <p className="rounded-brand bg-muted/40 p-3 text-sm text-foreground/80">
              "{existingNote}"
            </p>
          )}
          {followUpWanted && (
            <Badge variant="outline" className="w-fit rounded-full">
              Follow-up requested
            </Badge>
          )}
          <div className="pt-2">
            <Link
              to="/listeners"
              className="text-sm text-brand-primary hover:underline"
            >
              Back to Listeners →
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-brand border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-base font-medium">How was your session?</h3>
          <p className="text-xs text-muted-foreground">
            Private to you — used to improve your matches.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
              className="p-1"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  rating >= n
                    ? "fill-brand-primary text-brand-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fb-note" className="text-xs">
            Anything you'd like to remember? (optional)
          </Label>
          <Textarea
            id="fb-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What helped, what didn't, how you're feeling now…"
            maxLength={2000}
          />
        </div>
        <div className="flex items-center justify-between rounded-brand bg-muted/40 px-3 py-2 text-sm">
          <Label htmlFor="fb-follow" className="cursor-pointer">
            I'd like a follow-up with this listener
          </Label>
          <Switch
            id="fb-follow"
            checked={followUp}
            onCheckedChange={setFollowUp}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => mut.mutate()}
            disabled={rating === 0 || mut.isPending}
            className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
            {mut.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit feedback
          </Button>
          <Button asChild variant="ghost">
            <Link to="/listeners">Skip</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



