import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConversationMessages } from "@/lib/conversations.functions";
import { getMyAiQuota } from "@/lib/quota.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
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
        <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <ChatSurface
      key={threadId}
      threadId={threadId}
      initialMessages={initialUiMessages}
    />
  );
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
            body: { messages, conversationId: id },
          };
        },
      }),
    [],
  );

  const qc = useQueryClient();
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
        toast.error("You've hit your monthly Companion limit. Upgrade to keep chatting.");
      }
      console.error("[chat]", err);
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["ai-quota"] });
    },
  });

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);
  useEffect(() => {
    if (status === "ready") {
      inputRef.current?.focus();
      refetchQuota();
    }
  }, [status, refetchQuota]);

  const busy = status === "submitted" || status === "streaming";
  const unlimited = !!quota && quota.unlimited;
  const outOfQuota = !!quota && !unlimited && (quota.remaining ?? 0) <= 0;
  const lowQuota = !!quota && !unlimited && (quota.remaining ?? 0) > 0 && (quota.remaining ?? 0) <= 5;

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
            ? `You've used all ${quota.limit} Companion messages this month. Upgrade your Care Membership in Settings to continue.`
            : `${quota.remaining} of ${quota.limit} Companion messages left this month.`}
        </div>
      )}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Take a breath. Say whatever's on your mind, even just a word.
            </div>
          ) : (
            messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              return (
                <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 dark:prose-invert">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : (
                    <MessageContent>{text}</MessageContent>
                  )}
                </Message>
              );
            })
          )}
          {status === "submitted" ? (
            <Message from="assistant">
              <Shimmer>Listening…</Shimmer>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <div className="mx-auto w-full max-w-2xl">
          <PromptInput
            onSubmit={(msg) => {
              const text = msg.text?.trim();
              if (!text) return;
              if (outOfQuota) {
                toast.error("Monthly Companion limit reached. Upgrade in Settings.");
                return;
              }
              void sendMessage({ text });
            }}
          >
            <PromptInputTextarea
              ref={inputRef}
              placeholder={outOfQuota ? "Limit reached, upgrade to continue" : "What's on your mind?"}
              disabled={busy || outOfQuota}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={busy || outOfQuota} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
