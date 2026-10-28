import { createFileRoute } from "@tanstack/react-router";
import { handleCompanionTranscription } from "@/lib/ai/transcription.server";

export const Route = createFileRoute("/api/companion-transcription")({
  server: {
    handlers: {
      POST: ({ request }) => handleCompanionTranscription(request),
    },
  },
});
