import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { useRecording, useObjectUrl } from "@/features/media/use-recording";
import { mediaFile } from "@/features/media/recording";
import { useIdentity, assertIdentity } from "@/features/session/session-store";
import { useTimeZone } from "@/lib/frontend/use-time-zone";
import { localInput, localToUtc, displayTime } from "@/lib/frontend/time";
import {
  cancelSendLater,
  createSendLater,
  getSendLaterMedia,
  listReceivedSendLater,
  listSendLater,
  listSendLaterContacts,
} from "@/lib/send-later.functions";

export const Route = createFileRoute("/_authenticated/send-later")({
  validateSearch: (search: Record<string, unknown>): { section?: "studio" } => ({
    section: search.section === "studio" ? "studio" : undefined,
  }),
  component: SendLaterPage,
  head: () => ({ meta: [{ title: "Send Later | SomeoneNear" }] }),
});
const kindSchema = z.enum(["text", "voice", "video"]);
const contactSchema = z.object({ userId: z.string().uuid(), name: z.string().min(1).max(120) });
const messageSchema = z.object({
  id: z.string().uuid(),
  kind: kindSchema,
  body: z.string().nullable(),
  s3_key: z.string().nullable(),
  scheduled_at: z.string(),
  status: z.string(),
  recipient_name: z.string().optional(),
  profiles: z.object({ display_name: z.string().nullable() }).optional(),
});
const inputSchema = z.object({
  recipient: contactSchema,
  scheduledAt: z.string().datetime(),
  body: z.string(),
  kind: kindSchema,
});
function SendLaterPage() {
  const { userId, generation } = useIdentity();
  const qc = useQueryClient();
  const zone = useTimeZone();
  const recorder = useRecording();
  const previewUrl = useObjectUrl(recorder.blob);
  const [kind, setKind] = useState<z.infer<typeof kindSchema>>("text");
  const [vaultTab, setVaultTab] = useState("gallery");
  const { section } = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (section !== "studio") return;
    setVaultTab("studio");
    setKind("voice");
    void navigate({ search: { section: undefined }, replace: true });
  }, [section, navigate]);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const defaultWhen = useMemo(
    () => (zone.data ? localInput(new Date(Date.now() + 24 * 3600_000), zone.data) : ""),
    [zone.data],
  );
  const [when, setWhen] = useState("");
  const activeWhen = when || defaultWhen;
  const [playback, setPlayback] = useState<{ url: string; kind: "voice" | "video" } | null>(null);
  useEffect(() => {
    if (userId && !recipientId) {
      setRecipientId(userId);
    }
  }, [userId, recipientId]);

  const list = useServerFn(listSendLater);
  const inbox = useServerFn(listReceivedSendLater);
  const contactsFn = useServerFn(listSendLaterContacts);
  const create = useServerFn(createSendLater);
  const cancel = useServerFn(cancelSendLater);
  const media = useServerFn(getSendLaterMedia);
  const query = useQuery({
    queryKey: ["send-later", userId],
    enabled: !!userId,
    retry: 1,
    queryFn: async () => {
      const [messages, received, contacts] = await Promise.all([list(), inbox(), contactsFn()]);
      assertIdentity(generation);
      return {
        messages: z.array(messageSchema).parse(messages),
        received: z.array(messageSchema).parse(received),
        contacts: z.array(contactSchema).parse(contacts),
      };
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["send-later", userId] });
  const save = useMutation({
    mutationFn: async () => {
      assertIdentity(generation);
      if (!zone.data) throw new Error("Your timezone is still loading. Please try again.");
      const targetUserId = recipientId || userId || query.data?.contacts[0]?.userId || "";
      const recipient = (targetUserId ? query.data?.contacts.find((c) => c.userId === targetUserId) : null) || {
        userId: targetUserId || userId || crypto.randomUUID(),
        name: "You (Future Self · Time Capsule)",
      };
      const parsed = inputSchema.parse({
        recipient,
        scheduledAt: localToUtc(activeWhen, zone.data),
        body,
        kind,
      });
      if (Date.parse(parsed.scheduledAt) < Date.now() + 60_000)
        throw new Error("Choose a time at least a minute in the future.");
      if (kind === "text" && !body.trim()) throw new Error("Write your message first.");
      const fd = new FormData();
      fd.set("recipientName", parsed.recipient.name);
      fd.set("recipientUserId", parsed.recipient.userId);
      fd.set("scheduledAt", parsed.scheduledAt);
      fd.set("kind", kind);
      fd.set("body", body);
      if (kind !== "text") {
        if (!recorder.blob) throw new Error("Record or upload your message first.");
        fd.set("file", mediaFile(recorder.blob, kind));
        fd.set("duration", String(Math.round(recorder.duration)));
      }
      const result = await create({ data: fd });
      assertIdentity(generation);
      return result;
    },
    onSuccess: () => {
      recorder.cancel();
      setBody("");
      setWhen("");
      setRecipientId("");
      toast.success("Your message is scheduled.");
      void invalidate();
    },
  });
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      assertIdentity(generation);
      await cancel({ data: { id } });
      assertIdentity(generation);
    },
    onSuccess: () => {
      toast.success("Message cancelled.");
      void invalidate();
    },
  });
  const play = useMutation({
    mutationFn: async (message: z.infer<typeof messageSchema>) => {
      const result = z
        .object({ url: z.string().url() })
        .parse(await media({ data: { id: message.id } }));
      assertIdentity(generation);
      if (new URL(result.url).protocol !== "https:") throw new Error("Recording unavailable.");
      if (message.kind !== "text") setPlayback({ url: result.url, kind: message.kind });
    },
  });
  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-input bg-card px-3 py-2";
  const failure = save.error || cancelMutation.error || play.error;
  return (
    <AppShell>
      <div className="sn-worker-vault space-y-6">
        <PageHeader
          eyebrow="💌 Page 5 · Memory Vault & Time Capsules"
          title="A warm family scrapbook of voices, Polaroids & future letters."
          description="Schedule a message for someone in your family circle. They can find it in SomeoneNear when it arrives."
        />
        <div className="sn-worker-game-tabs" role="tablist" aria-label="Memory vault sections">
          {[
            ["gallery", "🖼️ ① Polaroid & Vinyl Gallery"],
            ["studio", "🎙️ ② 1-Click Voice Studio"],
            ["capsules", "⏳ ③ Time Capsules"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vaultTab === id}
              onClick={() => {
                recorder.cancel();
                setVaultTab(id);
                setKind(id === "studio" ? "voice" : "text");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {query.isPending || zone.isPending ? (
          <DataSkeleton />
        ) : query.isError || zone.isError ? (
          <DataError
            retry={() => {
              void query.refetch();
              void zone.refetch();
            }}
          />
        ) : (
          <>
            {vaultTab !== "gallery" &&
              (query.data.contacts.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                  <p>
                    There are no recipients in your circle yet. Add someone to your family circle to schedule a message.
                  </p>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/family">Open Family Circle →</Link>
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-5 rounded-3xl border border-border bg-card p-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!save.isPending) save.mutate();
                  }}
                >
                  <fieldset disabled={save.isPending} className="space-y-5 disabled:opacity-70">
                    <legend className="font-semibold">Your message</legend>
                    <label className="block">
                      Message type
                      <select
                        className={inputClass}
                        value={kind}
                        onChange={(event) => {
                          recorder.cancel();
                          setKind(kindSchema.parse(event.target.value));
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="voice">Voice</option>
                        <option value="video">Video</option>
                      </select>
                    </label>
                    <label className="block">
                      For
                      <select
                        className={inputClass}
                        value={recipientId || userId || ""}
                        onChange={(event) => setRecipientId(event.target.value)}
                      >
                        {userId && (
                          <option value={userId}>You (Future Self · Time Capsule)</option>
                        )}
                        {query.data.contacts
                          .filter((c) => c.userId !== userId)
                          .map((contact) => (
                            <option key={contact.userId} value={contact.userId}>
                              {contact.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {kind === "text" ? (
                      <label className="block">
                        Your words
                        <textarea
                          className={`${inputClass} min-h-32`}
                          required
                          value={body}
                          onChange={(event) => setBody(event.target.value)}
                        />
                      </label>
                    ) : (
                      <div className="space-y-3">
                        {recorder.requesting ? (
                          <p role="status">Waiting for microphone permission…</p>
                        ) : recorder.recording ? (
                          <p role="status">Recording…</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3">
                          {recorder.recording ? (
                            <Button type="button" onClick={recorder.stop}>
                              Stop recording
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              disabled={recorder.requesting}
                              onClick={() => void recorder.start(kind)}
                            >
                              Record {kind}
                            </Button>
                          )}
                          <Button type="button" variant="outline" onClick={recorder.cancel}>
                            Cancel recording
                          </Button>
                        </div>
                        <label className="block text-sm">
                          Or upload a recording (up to 25 MiB)
                          <input
                            className={inputClass}
                            type="file"
                            accept={
                              kind === "voice"
                                ? "audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav"
                                : "video/webm,video/mp4"
                            }
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) recorder.upload(file, kind);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        {previewUrl &&
                          (kind === "video" ? (
                            <video
                              controls
                              src={previewUrl}
                              className="aspect-video w-full rounded-xl"
                            />
                          ) : (
                            <audio controls src={previewUrl} className="w-full" />
                          ))}
                        {recorder.error && <p role="alert">{recorder.error}</p>}
                      </div>
                    )}
                    <label className="block">
                      Date & time ({zone.data})
                      <input
                        className={inputClass}
                        type="datetime-local"
                        required
                        min={localInput(new Date(Date.now() + 120_000), zone.data)}
                        value={activeWhen}
                        onChange={(event) => setWhen(event.target.value)}
                      />
                    </label>
                    <Button
                      type="submit"
                      disabled={
                        save.isPending ||
                        recorder.recording ||
                        recorder.requesting ||
                        (kind !== "text" && !recorder.blob)
                      }
                    >
                      {save.isPending ? "Scheduling…" : "Schedule message"}
                    </Button>
                  </fieldset>
                </form>
              ))}
            {failure && (
              <div role="alert" className="rounded-xl border border-border bg-surface p-4">
                <p>
                  {failure instanceof z.ZodError
                    ? "Please check the recipient and message details."
                    : failure.message}
                </p>
                <p className="mt-2 text-sm">
                  Your changes were not confirmed. Please check your message list before trying
                  again.
                </p>
              </div>
            )}
            {playback && (
              <section
                aria-label="Message playback"
                className="rounded-xl border border-border bg-card p-4"
              >
                {playback.kind === "video" ? (
                  <video controls src={playback.url} className="aspect-video w-full" />
                ) : (
                  <audio controls src={playback.url} className="w-full" />
                )}
                <Button variant="ghost" onClick={() => setPlayback(null)}>
                  Close playback
                </Button>
              </section>
            )}
            {[
              { title: "For you", messages: query.data.received },
              { title: "Your scheduled messages", messages: query.data.messages },
            ].map((group) => (
              <section key={group.title} className="space-y-3">
                <h2 className="font-serif text-2xl font-bold">{group.title}</h2>
                {group.messages.length === 0 ? (
                  <p className="rounded-xl border border-border bg-surface p-5">
                    No messages here yet.
                  </p>
                ) : (
                  group.messages.map((message) => (
                    <article
                      key={message.id}
                      className="rounded-2xl border border-border bg-card p-5"
                    >
                      <h3 className="font-semibold">
                        {message.recipient_name ||
                          message.profiles?.display_name ||
                          "Family message"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {displayTime(message.scheduled_at, zone.data)} · {message.status}
                      </p>
                      {message.body && (
                        <p className="mt-3 whitespace-pre-wrap break-words">{message.body}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.s3_key && (
                          <Button
                            variant="outline"
                            disabled={play.isPending}
                            onClick={() => play.mutate(message)}
                          >
                            Play recording
                          </Button>
                        )}
                        {message.status === "scheduled" && (
                          <Button
                            variant="outline"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(message.id)}
                          >
                            Cancel message
                          </Button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
