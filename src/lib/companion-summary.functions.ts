import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getMyCompanionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createCompanionStore } = await import("./companion-store.server");
    return createCompanionStore(process.env).loadSummary(context.userId);
  });
export const clearMyCompanionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createCompanionStore } = await import("./companion-store.server");
    await createCompanionStore(process.env).clearSummary(context.userId);
    return { ok: true };
  });
