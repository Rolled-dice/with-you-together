import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createSendLater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((formData: FormData) => {
    const kind = String(formData.get("kind") ?? "text");
    if (!["text", "voice", "video"].includes(kind))
      throw new Error("Invalid message type");
    const file = formData.get("file");
    return {
      recipientName: z.string().min(1).max(120).parse(formData.get("recipientName")),
      kind: kind as "text" | "voice" | "video",
      body: formData.get("body") ? String(formData.get("body")) : undefined,
      scheduledAt: z.string().parse(formData.get("scheduledAt")),
      file: file instanceof File ? file : null,
      mediaDurationSeconds: formData.get("duration")
        ? Number(formData.get("duration"))
        : null,
    };
  })
  .handler(async ({ context, data }) => {
    const { createScheduledMessage } = await import("@/lib/send-later.server");
    return createScheduledMessage(context, data);
  });

export const listSendLater = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listScheduledMessages } = await import("@/lib/send-later.server");
    return listScheduledMessages(context);
  });

export const cancelSendLater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { cancelScheduledMessage } = await import("@/lib/send-later.server");
    return cancelScheduledMessage(context, data.id);
  });

export const getSendLaterMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { getMediaUrl } = await import("@/lib/send-later.server");
    return getMediaUrl(context, data.id);
  });
