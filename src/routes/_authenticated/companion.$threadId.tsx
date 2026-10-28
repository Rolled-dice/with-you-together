import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConversationMessages } from "@/lib/conversations.functions";
import { getMyAiQuota } from "@/lib/quota.functions";
import { supabase } from "@/integrations/supabase/client";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { CompanionComposer } from "@/components/companion-composer";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/companion/$threadId")({
  component: CompanionThread,
});

function CompanionThread() {
  const { threadId } = Route.useParams();
  const getMessages = useServerFn(getConversationMessages);

  const { data: initial, isLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => getMessages({ data: { id: threadId } }),
  });

  const initialUiMessages: UIMessage[] = useMemo(
    () =>
      (initial ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        parts: [{ type: "text", text: m.content }],
      })),
    [initial],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <SpinnerGapIcon className="h-5 w-5 animate-spin text-brand-primary" />
      </div>
    );
  }

  return <ChatSurface key={threadId} threadId={threadId} initialMessages={initialUiMessages} />;
}

function ChatSurface({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, id }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? "";
          return {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: { messages: messages.slice(-1), conversationId: id },
          };
        },
      }),
    [],
  );

  const qc = useQueryClient();
  const [chatError, setChatError] = useState("");
  const quotaFn = useServerFn(getMyAiQuota);
  const { data: quota, refetch: refetchQuota } = useQuery({
    queryKey: ["ai-quota"],
    queryFn: () => quotaFn(),
  });

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      const msg = (err as Error).message || "";
      if (msg.includes("quota_exceeded") || msg.includes("429")) {
        toast.error(
          "You've used today's Companion messages. They refill tomorrow, or upgrade to Care Plus.",
        );
      } else {
        let readable = "Companion could not respond. Please try again shortly.";
        try {
          const payload: unknown = JSON.parse(msg);
          const parsed = z.object({ message: z.string().max(500) }).safeParse(payload);
          if (parsed.success) readable = parsed.data.message;
        } catch {
          if (msg && !msg.startsWith("{")) readable = msg;
        }
        setChatError(readable);
      }
      console.error("[chat]", err);
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["ai-quota"] });
    },
  });

  useEffect(() => {
    if (status === "ready") {
      refetchQuota();
    }
  }, [status, refetchQuota]);

  const busy = status === "submitted" || status === "streaming";
  const unlimited = !!quota && quota.unlimited;
  const outOfQuota = !!quota && !unlimited && (quota.remaining ?? 0) <= 0;
  const lowQuota =
    !!quota && !unlimited && (quota.remaining ?? 0) > 0 && (quota.remaining ?? 0) <= 5;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {quota && !unlimited && (
        <div
          className={
            "border-b border-border px-4 py-2 text-xs " +
            (outOfQuota
              ? "bg-destructive/10 text-destructive"
              : lowQuota
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-muted/40 text-muted-foreground")
          }
        >
          {outOfQuota
            ? `You've used today's ${quota.limit} Companion messages. They refill tomorrow, or upgrade to Care Plus in Settings for unlimited chats.`
            : `${quota.remaining} of ${quota.limit} Companion messages left today.`}
        </div>
      )}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-4 p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Take a breath. Say whatever's on your mind, even just a word.
            </div>
          ) : (
            messages.map((m) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              return (
                <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                  {m.role === "assistant" ? (
                    <div className="prose max-w-none break-words text-base leading-relaxed text-foreground prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 dark:prose-invert [overflow-wrap:anywhere]">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : (
                    <MessageContent className="whitespace-pre-wrap break-words text-base leading-relaxed [overflow-wrap:anywhere]">
                      {text}
                    </MessageContent>
                  )}
                </Message>
              );
            })
          )}
          {status === "submitted" ? (
            <Message from="assistant">
              <Shimmer>Thinking…</Shimmer>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton className="size-11" aria-label="Scroll to latest message" />
      </Conversation>

      <div className="shrink-0 border-t border-border p-3 sm:p-4">
        <div className="mx-auto w-full max-w-3xl">
          {chatError && (
            <p role="alert" className="mb-3 break-words text-sm text-destructive">
              {chatError}
            </p>
          )}
          <CompanionComposer
            status={status}
            disabled={busy || outOfQuota}
            onSend={(text) => {
              if (outOfQuota) {
                toast.error("Monthly Companion limit reached. Upgrade in Settings.");
                return;
              }
              setChatError("");
              return sendMessage({ text });
            }}
          />
        </div>
      </div>
    </div>
  );
}
