import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { format } from "date-fns";
import {
  CalendarHeart,
  Mic,
  Video,
  Type,
  Square,
  Trash2,
  Play,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  cancelSendLater,
  createSendLater,
  getSendLaterMedia,
  listReceivedSendLater,
  listSendLater,
  listSendLaterContacts,
} from "@/lib/send-later.functions";

export const Route = createFileRoute("/_authenticated/send-later")({
  component: SendLaterPage,
  head: () => ({
    meta: [
      { title: "Send It Later — SomeoneNear" },
      {
        name: "description",
        content:
          "Schedule a text, voice, or video message for someone you love — delivered when it matters most.",
      },
    ],
  }),
});

type Kind = "text" | "voice" | "video";

function SendLaterPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>("text");
  const [recipient, setRecipient] = useState("");
  const [recipientUserId, setRecipientUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["send-later"],
    queryFn: () => listSendLater(),
    refetchInterval: 30_000,
  });

  const { data: received = [] } = useQuery({
    queryKey: ["send-later-received"],
    queryFn: () => listReceivedSendLater(),
    refetchInterval: 30_000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["send-later-contacts"],
    queryFn: () => listSendLaterContacts(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["send-later"] });

  const createMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.set("recipientName", recipient);
      if (recipientUserId) fd.set("recipientUserId", recipientUserId);
      fd.set("kind", kind);
      fd.set("body", body);
      fd.set("scheduledAt", new Date(when).toISOString());
      if (blob) {
        const mime = kind === "video" ? "video/webm" : "audio/webm";
        fd.set("file", new File([blob], `message.webm`, { type: blob.type || mime }));
        fd.set("duration", String(Math.round(duration)));
      }
      return createSendLater({ data: fd });
    },
    onSuccess: () => {
      toast.success("It's scheduled 💌 We'll keep it safe until it's time.");
      setBody("");
      setBlob(null);
      setDuration(0);
      setRecipient("");
      setWhen("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelSendLater({ data: { id } }),
    onSuccess: () => {
      toast.success("Cancelled");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      });
      const rec = new MediaRecorder(stream);
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setBlob(new Blob(parts, { type: rec.mimeType }));
        setDuration((Date.now() - startedRef.current) / 1000);
      };
      recorderRef.current = rec;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
      setBlob(null);
    } catch {
      toast.error(
        kind === "video"
          ? "Camera/microphone blocked — allow access to record a video message."
          : "Microphone blocked — allow access to record a voice message.",
      );
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const playMedia = async (id: string) => {
    try {
      const { url } = await getSendLaterMedia({ data: { id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const minWhen = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8 pb-24">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
            <Mail className="size-4" /> A little presence. A lot of difference.
          </div>
          <h1 className="text-2xl font-semibold">
            Write something they'll be happy to receive…
          </h1>
          <p className="text-muted-foreground text-sm">
            A birthday, a tough day, or “listen when you miss me” — schedule it
            and we'll keep it safe until it's time.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2">
            {(
              [
                ["text", Type, "Text"],
                ["voice", Mic, "Voice"],
                ["video", Video, "Video"],
              ] as const
            ).map(([k, Icon, label]) => (
              <Button
                key={k}
                variant={kind === k ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setKind(k);
                  setBlob(null);
                }}
              >
                <Icon className="size-4" /> {label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Send to: choose someone (e.g. Dad)"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setRecipientUserId(null);
              }}
            />
            {contacts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contacts.map((c: any) => (
                  <Button
                    key={c.userId}
                    type="button"
                    size="sm"
                    variant={recipientUserId === c.userId ? "default" : "outline"}
                    onClick={() => {
                      setRecipient(c.name);
                      setRecipientUserId(c.userId);
                    }}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
            {recipientUserId && (
              <p className="text-xs text-muted-foreground">
                They'll get a notification in the app when it's delivered.
              </p>
            )}
          </div>

          {kind === "text" ? (
            <Textarea
              rows={5}
              placeholder="Write from the heart…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-3">
              {blob ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Recording ready · {Math.round(duration)}s
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = URL.createObjectURL(blob);
                        window.open(url, "_blank");
                      }}
                    >
                      <Play className="size-4" /> Preview
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setBlob(null)}>
                      Re-record
                    </Button>
                  </div>
                </div>
              ) : recording ? (
                <Button variant="destructive" onClick={stopRecording}>
                  <Square className="size-4" /> Stop recording
                </Button>
              ) : (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={startRecording}>
                    <Mic className="size-4" /> Record {kind}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => fileRef.current?.click()}
                  >
                    Upload a file
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={kind === "video" ? "video/*" : "audio/*"}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setBlob(f);
                        setDuration(0);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">
                Date &amp; time
              </label>
              <Input
                type="datetime-local"
                min={minWhen}
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <Button
              disabled={
                createMut.isPending ||
                !recipient.trim() ||
                !when ||
                (kind === "text" ? !body.trim() : !blob)
              }
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarHeart className="size-4" />
              )}
              Schedule it
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-medium">Your scheduled messages</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled yet — your future hellos will live here.
            </p>
          ) : (
            messages.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {m.kind}
                    </Badge>
                    <span className="font-medium truncate">
                      {m.recipient_name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(m.scheduled_at), "d MMMM · h:mm a")} ·{" "}
                    <span className="capitalize">{m.status}</span>
                  </p>
                  {m.body && (
                    <p className="text-sm mt-1 line-clamp-2">{m.body}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {m.s3_key && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => playMedia(m.id)}
                      aria-label="Play recording"
                    >
                      <Play className="size-4" />
                    </Button>
                  )}
                  {m.status === "scheduled" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelMut.mutate(m.id)}
                      aria-label="Cancel message"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
