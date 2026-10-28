import { createFileRoute } from "@tanstack/react-router";
import { handleSmsHook } from "@/lib/auth-sms-hook.server";

export const Route = createFileRoute("/api/public/auth-sms")({
  server: { handlers: { POST: ({ request }) => handleSmsHook(request) } },
});
