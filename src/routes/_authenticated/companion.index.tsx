import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createConversation } from "@/lib/conversations.functions";
import { getIdentity, useIdentity } from "@/features/session/session-store";
import { prepareCompanionDraft } from "@/lib/companion-draft";
export const Route = createFileRoute("/_authenticated/companion/")({ component: CompanionStart });
function CompanionStart() {
  const [text, setText] = useState("");
  const identity = useIdentity();
  const create = useServerFn(createConversation);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const start = useMutation({
    mutationFn: async (message: string) => ({ conversation: await create(), message, identity }),
    onSuccess: ({ conversation, message, identity: started }) => {
      const current = getIdentity();
      if (
        !started.userId ||
        current.userId !== started.userId ||
        current.generation !== started.generation
      )
        return;
      prepareCompanionDraft({
        userId: started.userId,
        generation: started.generation,
        threadId: conversation.id,
        text: message,
      });
      void cache.invalidateQueries({ queryKey: ["conversations", started.userId] });
      navigate({ to: "/companion/$threadId", params: { threadId: conversation.id } });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn’t open a conversation. Please try again.",
      ),
  });
  return (
    <div className="sn-worker-chat-start">
      <div className="sn-worker-chat-bubble">
        <strong>🌙 Your quiet-hours space</strong>
        <p>
          Hey. It’s okay to show up with a full mind, or no words at all. What’s the night feeling
          like for you?
        </p>
        <p>Answer in a word, tap a thought, or take your time.</p>
      </div>
      <div className="sn-worker-chat-openers">
        <span>A small place to begin</span>
        <div>
          {[
            "can’t sleep again",
            "house feels quiet tonight",
            "worried about Mum & Dad",
            "just one word: tired",
            "help me slow down",
            "skip question →",
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled={start.isPending}
              onClick={() => start.mutate(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <form
        className="sn-companion-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) start.mutate(text.trim());
        }}
      >
        <label htmlFor="companion-first-message">What’s on your mind?</label>
        <textarea
          id="companion-first-message"
          value={text}
          maxLength={8000}
          onChange={(event) => setText(event.target.value)}
          placeholder="One word is enough…"
          disabled={start.isPending}
        />
        <button
          className="sn-worker-button"
          type="submit"
          disabled={start.isPending || !text.trim()}
        >
          {start.isPending ? "Opening your conversation…" : "Send →"}
        </button>
      </form>
      <p className="sn-worker-footnote">
        AI companionship, at your pace. Not emergency support or a replacement for professional
        care. Visit Safety if you need immediate support.
      </p>
    </div>
  );
}
