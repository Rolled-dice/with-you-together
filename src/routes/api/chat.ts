import { createFileRoute } from "@tanstack/react-router";
import { handleCompanionChat } from "@/lib/ai/chat.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: ({ request }) => handleCompanionChat(request),
    },
  },
});
