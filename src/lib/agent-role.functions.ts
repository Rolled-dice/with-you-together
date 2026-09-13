import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** True when the signed-in user is an active call agent. */
export const isCurrentUserAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("is_call_agent", {
      _uid: context.userId,
    });
    if (error) return { isAgent: false };
    return { isAgent: Boolean(data) };
  });
