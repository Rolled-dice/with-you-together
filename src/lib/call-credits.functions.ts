import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createExtraCallCheckout, getExtraCallOptions } from "./call-credits.server";

export const getMyExtraCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getExtraCallOptions(context.userId));
export const buyExtraCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        currency: z.enum(["INR", "USD"]),
        expiry_accepted: z.literal(true),
        expires_at: z.string().datetime({ offset: true }),
      })
      .parse(input),
  )
  .handler(({ context, data }) =>
    createExtraCallCheckout(context.userId, data.currency, data.expires_at),
  );
