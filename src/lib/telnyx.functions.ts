import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  hangupBookingCall,
  requireAgent,
  softphoneToken,
  startBookingCall,
  transferBookingCall,
} from "@/lib/telnyx-calls.server";
import {
  agentScreenPop,
  callTimeline,
  getRoutingRules,
  listMyQueue,
  saveDisposition,
  setPresence,
  supervisorSnapshot,
  updateRoutingRules,
} from "@/lib/call-console.server";

const BookingId = z.object({ booking_id: z.string().uuid() });

export const getSoftphoneToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAgent(context as never);
    return softphoneToken();
  });

export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookingId.parse(i))
  .handler(async ({ context, data }) => {
    return startBookingCall(context as never, data.booking_id);
  });

export const endTelnyxCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookingId.parse(i))
  .handler(async ({ context, data }) => {
    return hangupBookingCall(context as never, data.booking_id);
  });

export const transferCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingId.extend({ to: z.string().min(5).max(32) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    return transferBookingCall(context as never, data.booking_id, data.to);
  });

export const getAgentQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listMyQueue(context as never));

export const getScreenPop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookingId.parse(i))
  .handler(async ({ context, data }) => agentScreenPop(context as never, data.booking_id));

export const getCallTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookingId.parse(i))
  .handler(async ({ context, data }) => callTimeline(context as never, data.booking_id));

export const setAgentPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        state: z.enum(["available", "on_call", "wrap_up", "offline"]),
        booking_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) =>
    setPresence(context as never, data.state, data.booking_id ?? null),
  );

export const submitDisposition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingId.extend({
      outcome: z.enum([
        "connected",
        "no_answer",
        "voicemail",
        "wrong_number",
        "member_declined",
        "tech_failure",
      ]),
      follow_up_needed: z.boolean().default(false),
      safety_concern: z.boolean().default(false),
      notes: z.string().max(4000).optional().default(""),
      wrap_up_seconds: z.number().int().min(0).max(7200).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => saveDisposition(context as never, data));

export const getSupervisorSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => supervisorSnapshot(context as never));

export const getRoutingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getRoutingRules(context as never));

export const saveRoutingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        require_skill_match: z.boolean(),
        timezone_tolerance_hours: z.number().int().min(0).max(12),
        enforce_working_hours: z.boolean(),
        max_concurrent_override: z.number().int().min(1).max(20).nullable(),
        skill_weight: z.number().int().min(0).max(100),
        load_weight: z.number().int().min(0).max(100),
        timezone_weight: z.number().int().min(0).max(100),
        fairness_weight: z.number().int().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => updateRoutingRules(context as never, data));
