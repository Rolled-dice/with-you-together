import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Post-call feedback for listener sessions. Calls are Telnyx outbound calls
 * (agent's browser leg bridged to the member's phone) — there is no in-app
 * call room, so this prompt is the member's only chance to rate a session
 * and ask for a follow-up. `call_ended_at` is set by the Telnyx webhook
 * handler in telnyx-calls.server.ts once the bridged call ends.
 */
export const getFeedbackPrompt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("listener_bookings")
      .select("id, call_ended_at, listeners(name)")
      .eq("user_id", context.userId)
      .not("call_ended_at", "is", null)
      .is("feedback_at", null)
      .order("call_ended_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const submitSessionFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        booking_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        note: z.string().max(2000).optional().default(""),
        follow_up: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({
        rating: data.rating,
        feedback_note: data.note || null,
        feedback_at: new Date().toISOString(),
        follow_up_wanted: data.follow_up,
      })
      .eq("id", data.booking_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
