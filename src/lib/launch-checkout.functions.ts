import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMarketId, type MarketId } from "./launch-catalog";
import { createLaunchTestCheckout } from "./launch-checkout.server";

export const createLaunchCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ plan: z.enum(["care", "care_plus"]), market: z.custom<MarketId>(isMarketId) })
      .strict()
      .parse(input),
  )
  .handler(({ data, context }) => createLaunchTestCheckout(data, context.userId));
