import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    // Keep the Companion shell usable while PostgREST refreshes a stale
    // conversations schema cache. A failed list read must not blank the page.
    if (error) return [];
    return data ?? [];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Generate the id locally and avoid a returning-select. The latter asks
    // PostgREST to serialize the table through its schema cache, which can be
    // briefly stale after production migrations even when inserts are valid.
    const id = crypto.randomUUID();
    const { error } = await context.supabase
      .from("conversations")
      .insert({ id, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: owned, error: ownershipError } = await context.supabase
      .from("conversations")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (ownershipError) throw new Error(ownershipError.message);
    if (!owned) throw new Error("Record not found.");
    const { createCompanionStore } = await import("./companion-store.server");
    await createCompanionStore(process.env).clearSummary(context.userId);
    const { error } = await context.supabase
      .from("conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", data.id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });
