import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  phone: z.string().min(6).max(30),
  country: z.string().length(2).nullable().optional(),
  channel: z.enum(["sms", "call"]).optional(),
});

export const startPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ context, data }) => {
    const { startVerification } = await import("@/lib/phone-verify.server");
    return startVerification(
      context.userId,
      data.phone,
      data.country ?? null,
      data.channel,
    );
  });

const ConfirmInput = z.object({
  code: z.string().min(4).max(8),
  country: z.string().length(2).nullable().optional(),
});

export const confirmPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConfirmInput.parse(input))
  .handler(async ({ context, data }) => {
    const { confirmVerification } = await import("@/lib/phone-verify.server");
    return confirmVerification(context.userId, data.code, data.country ?? null);
  });
