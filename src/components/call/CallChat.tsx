import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Mic, MicOff, Send } from "lucide-react";
import type { ChimeMeeting } from "@/hooks/useChimeMeeting";

function time(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** In-call chat over Chime data messages, with inline mic controls. */
export function CallChat({ meeting }: { meeting: ChimeMeeting }) {
  const {
    messages,
    micPermission,
    muted,
    selfRole,
    sendChatMessage,
    muteMic,
    unmuteMic,
  } = meeting;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card/60">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2">
        <p className="truncate text-sm font-semibold">Live chat</p>
        <Button
          size="sm"
          variant={muted ? "destructive" : "outline"}
          className="shrink-0"
          onClick={() => (muted ? unmuteMic() : muteMic())}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        >
          {muted ? (
            <MicOff className="mr-1.5 h-4 w-4" />
          ) : (
            <Mic className="mr-1.5 h-4 w-4" />
          )}
          {muted ? "Unmute" : "Mute"}
        </Button>
      </div>

      {micPermission === "denied" && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Microphone permission was blocked or revoked. Allow mic access in
            your browser settings, then rejoin to speak.
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Messages you send during the call appear here.
          </p>
        )}
        {messages.map((m) =>
          m.kind === "system" ? (
            <p
              key={m.id}
              className="text-center text-[11px] text-muted-foreground"
            >
              {m.body} · {time(m.at)}
            </p>
          ) : (
            <div
              key={m.id}
              className={`flex flex-col ${m.self ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {m.self
                  ? "You"
                  : m.senderRole === "listener"
                    ? "Listener"
                    : "User"}{" "}
                · {time(m.at)}
              </span>
              <span
                className={`max-w-[85%] break-words rounded-brand px-3 py-1.5 text-sm ${
                  m.self
                    ? "bg-brand-primary text-brand-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.body}
              </span>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendChatMessage(draft);
          setDraft("");
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message as ${selfRole === "listener" ? "listener" : "you"}…`}
          className="min-w-0"
        />
        <Button type="submit" size="icon" className="shrink-0" aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
