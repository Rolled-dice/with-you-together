import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getCompanionSummary,
  updateCompanionSummary,
  clearCompanionSummary,
} from "./memory.server";

export const getMyCompanionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getCompanionSummary(context.userId));

export const updateMyCompanionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ summaryText: z.string().max(1500) }).parse(data))
  .handler(({ context, data }) => updateCompanionSummary(context.userId, data.summaryText));

export const clearMyCompanionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => clearCompanionSummary(context.userId));
