import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, Track, type Participant } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Mic,
  MicOff,
  MessageCircle,
  SendHorizonal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CHAT_TOPIC = "someonenear-chat";

export type ChatRole = "user" | "listener";

type ChatMessage = {
  id: string;
  kind: "text";
  text: string;
  ts: number;
  role: ChatRole;
  mine: boolean;
};

type SystemMessage = {
  id: string;
  kind: "system";
  text: string;
  ts: number;
  tone: "muted" | "unmuted";
};

type ThreadItem = ChatMessage | SystemMessage;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function roleLabel(role: ChatRole) {
  return role === "listener" ? "Listener" : "You";
}

/**
 * In-call chat over LiveKit data messages (this project uses LiveKit, not Chime).
 * Renders the thread, mic-status system events, a mic toggle and a permission banner.
 */
export function CallChatPanel({
  role,
  onClose,
  className,
}: {
  role: ChatRole;
  onClose?: () => void;
  className?: string;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [draft, setDraft] = useState("");
  const [micBlocked, setMicBlocked] = useState(false);
  const [togglingMic, setTogglingMic] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback((item: ThreadItem) => {
    setItems((prev) => [...prev.slice(-199), item]);
  }, []);

  const { send } = useDataChannel(CHAT_TOPIC, (msg) => {
    try {
      const payload = JSON.parse(decoder.decode(msg.payload)) as {
        text?: string;
        ts?: number;
        role?: ChatRole;
      };
      if (!payload.text) return;
      push({
        id: `${msg.from?.sid ?? "remote"}-${payload.ts ?? Date.now()}-${Math.random()}`,
        kind: "text",
        text: payload.text,
        ts: payload.ts ?? Date.now(),
        role: payload.role === "listener" ? "listener" : "user",
        mine: false,
      });
    } catch {
      // ignore malformed payloads
    }
  });

  // Mic status indicators for both sides.
  useEffect(() => {
    if (!room) return;
    const who = (p: Participant) =>
      p.identity === localParticipant?.identity
        ? "You"
        : p.name || "Your partner";

    const onMuted = (pub: { source: Track.Source }, p: Participant) => {
      if (pub.source !== Track.Source.Microphone) return;
      push({
        id: `sys-${Date.now()}-${Math.random()}`,
        kind: "system",
        tone: "muted",
        ts: Date.now(),
        text: `${who(p)} muted the microphone`,
      });
    };
    const onUnmuted = (pub: { source: Track.Source }, p: Participant) => {
      if (pub.source !== Track.Source.Microphone) return;
      push({
        id: `sys-${Date.now()}-${Math.random()}`,
        kind: "system",
        tone: "unmuted",
        ts: Date.now(),
        text: `${who(p)} unmuted the microphone`,
      });
    };
    const onDeviceError = () => setMicBlocked(true);

    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    room.on(RoomEvent.MediaDevicesError, onDeviceError);
    return () => {
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
      room.off(RoomEvent.MediaDevicesError, onDeviceError);
    };
  }, [room, localParticipant?.identity, push]);

  // Watch for revoked microphone permission.
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    async function watch() {
      try {
        const p = await (
          navigator.permissions as Permissions & {
            query: (d: { name: string }) => Promise<PermissionStatus>;
          }
        ).query({ name: "microphone" });
        if (cancelled) return;
        status = p;
        const sync = () => setMicBlocked(p.state === "denied");
        sync();
        p.addEventListener("change", sync);
      } catch {
        // Permissions API unsupported, rely on device errors instead.
      }
    }
    void watch();
    return () => {
      cancelled = true;
      status = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length]);

  const canSend = draft.trim().length > 0;

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const ts = Date.now();
    try {
      send(encoder.encode(JSON.stringify({ text, ts, role })), {
        reliable: true,
      });
    } catch {
      // still show locally; delivery failures surface via connection state
    }
    push({
      id: `me-${ts}`,
      kind: "text",
      text,
      ts,
      role,
      mine: true,
    });
    setDraft("");
  }, [draft, push, role, send]);

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    setTogglingMic(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      setMicBlocked(false);
    } catch {
      setMicBlocked(true);
    } finally {
      setTogglingMic(false);
    }
  }, [isMicrophoneEnabled, localParticipant]);

  const thread = useMemo(() => items, [items]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0 text-brand-primary" />
          <span className="truncate text-sm font-medium">Live chat</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant={isMicrophoneEnabled ? "outline" : "destructive"}
            onClick={() => void toggleMic()}
            disabled={togglingMic}
            aria-pressed={!isMicrophoneEnabled}
            aria-label={
              isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"
            }
          >
            {isMicrophoneEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
            <span className="ml-1.5 text-xs">
              {isMicrophoneEnabled ? "Mute" : "Unmute"}
            </span>
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {micBlocked && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Microphone access is blocked. Allow the mic in your browser's site
            settings, then tap Unmute to rejoin the conversation.
          </span>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {thread.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Messages stay in this room only. Say hi, share a link, or drop a
              thought while you talk.
            </p>
          )}
          {thread.map((item) =>
            item.kind === "system" ? (
              <div
                key={item.id}
                className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {item.tone === "muted" ? (
                  <MicOff className="h-3 w-3" />
                ) : (
                  <Mic className="h-3 w-3" />
                )}
                {item.text} · {formatTime(item.ts)}
              </div>
            ) : (
              <div
                key={item.id}
                className={cn(
                  "flex max-w-[85%] flex-col gap-1",
                  item.mine ? "ml-auto items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium">
                    {item.mine ? "You" : roleLabel(item.role)}
                  </span>
                  <span>{formatTime(item.ts)}</span>
                </div>
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words rounded-brand px-3 py-2 text-sm",
                    item.mine
                      ? "bg-brand-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {item.text}
                </div>
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Type a message…"
            aria-label="Message"
            className="max-h-32 min-h-[40px] resize-none"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
