import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { combineToUtc } from "./time-zone";

export const listListeners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("listeners")
      .select("id, name, headline, bio, focus_areas, timezone, hourly_rate_cents, avatar_url")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("listener_bookings")
      .select(
        "id, listener_id, requested_at, duration_minutes, note, status, crm_state, listeners(name)",
      )
      .eq("user_id", context.userId)
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

/** Member-facing session balance for this month (drives the listeners summary). */
export const getMySessionBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSessionBalance } = await import("@/lib/family-sessions.server");
    return getSessionBalance(context.supabase, context.userId);
  });

/**
 * Booking rules
 * - Every session is booked in advance.
 * - The user picks preferred day, preferred time, and time zone.
 * - The system auto-assigns any active in-house listener with the lightest load.
 * - Reschedules within 2h of the scheduled time are refused (session marked used).
 */
const BookingInput = z.object({
  preferred_day: z.string().min(4), // YYYY-MM-DD
  preferred_time: z.string().min(3), // HH:MM (24h)
  time_zone: z.string().min(1),
  duration_minutes: z.literal(15).default(15),
  note: z.string().max(1000).default(""),
  booking_type: z.enum(["scheduled", "emergency_callback"]).default("scheduled"),
});


export const requestBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BookingInput.parse(input))
  .handler(async ({ context, data }) => {
    // Emergency callback: schedule ASAP marker, no listener picked yet.
    const requestedAt =
      data.booking_type === "emergency_callback"
        ? new Date().toISOString()
        : combineToUtc(data.preferred_day, data.preferred_time, data.time_zone);

    // Scheduled calls need at least 2 hours of lead time so ops can assign an agent.
    if (data.booking_type === "scheduled") {
      const leadMs = new Date(requestedAt).getTime() - Date.now();
      if (leadMs < 2 * 60 * 60 * 1000) {
        return {
          ok: false as const,
          code: "lead_time_required" as const,
          message: "Calls must be booked at least 2 hours ahead so we can assign a listener. Please pick a later time.",
        };
      }
    }


    // A listener calls the member's phone, so the number must be verified first.
    const { data: me } = await context.supabase
      .from("profiles")
      .select("phone, phone_verified")
      .eq("id", context.userId)
      .single();
    if (!me?.phone) {
      return {
        ok: false as const,
        code: "phone_required" as const,
        message: "Please add your mobile number in Settings so a listener can call you.",
      };
    }
    if (!me.phone_verified) {
      return {
        ok: false as const,
        code: "phone_verification_required" as const,
        message: "Please verify your mobile number in Settings before booking a call.",
      };
    }

    // Monthly Listener allowance. Family members (and owners) draw from the
    // family pool; solo users draw from their own plan's allowance. Both are
    // gated here before we assign a listener; the actual consume happens after
    // a successful insert.
    const { getSessionBalance } = await import("@/lib/family-sessions.server");
    const balance = await getSessionBalance(context.supabase, context.userId);
    if (balance.available <= 0) {
      return {
        ok: false as const,
        code: "no_sessions_left" as const,
        message: balance.inFamily
          ? "Your family's Listener sessions for this month are used up. Ask the family owner to allocate more, or try again next month."
          : balance.totalSessions === 0
            ? "Listener sessions aren't included on your current plan. Upgrade to book a call."
            : "You've used all your Listener sessions for this month. They'll refresh next month, or upgrade for more.",
      };
    }

    // Auto-assign: least-loaded active listener.
    const { data: listeners, error: lerr } = await context.supabase
      .from("listeners")
      .select("id")
      .eq("is_active", true);
    if (lerr) {
      return {
        ok: false as const,
        code: "booking_failed" as const,
        message: "We couldn't check listener availability. Please try again.",
      };
    }
    if (!listeners || listeners.length === 0) {
      return {
        ok: false as const,
        code: "team_at_capacity" as const,
        message: "Our team is at capacity right now. Please try another day.",
      };
    }

    // Fetch current queue counts and pick the smallest.
    const { data: existing } = await context.supabase
      .from("listener_bookings")
      .select("listener_id, status")
      .in("status", ["requested", "confirmed"]);
    const counts = new Map<string, number>();
    for (const l of listeners) counts.set(l.id, 0);
    for (const b of existing ?? []) {
      counts.set(b.listener_id, (counts.get(b.listener_id) ?? 0) + 1);
    }
    const assigned = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];

    const prefix =
      data.booking_type === "emergency_callback"
        ? `[EMERGENCY_CALLBACK][TZ:${data.time_zone}] `
        : `[TZ:${data.time_zone}] `;

    const { data: inserted, error } = await context.supabase
      .from("listener_bookings")
      .insert({
        user_id: context.userId,
        listener_id: assigned,
        requested_at: requestedAt,
        duration_minutes: 15,
        note: prefix + data.note,
        status: data.booking_type === "emergency_callback" ? "requested" : "confirmed",
        crm_state: "requested",
        sla_deadline: requestedAt,

      })
      .select("id")
      .single();
    if (error) {
      return {
        ok: false as const,
        code: "booking_failed" as const,
        message: error.code === "P0001" ? error.message : "We couldn't complete your booking. Please try again.",
      };
    }

    // The database reserves a credit in the same transaction as the booking.
    return { ok: true as const, id: inserted?.id };
  });

const RescheduleInput = z.object({
  id: z.string().uuid(),
  preferred_day: z.string().min(4),
  preferred_time: z.string().min(3),
  time_zone: z.string().min(1),
});

export const rescheduleBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RescheduleInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: booking, error: gerr } = await context.supabase
      .from("listener_bookings")
      .select("id, requested_at, status")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (gerr) throw new Error(gerr.message);
    if (!booking) throw new Error("Booking not found.");
    const startsAt = new Date(booking.requested_at).getTime();
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (startsAt - now < twoHoursMs) {
      throw new Error(
        "Reschedules must be made at least 2 hours before your session. Your existing booking has not changed.",
      );
    }
    // On-time reschedule: draw one from the family's monthly reschedule
    // allowance (no-op for solo users). Blocked when the allowance is used up.
    const newAt = combineToUtc(data.preferred_day, data.preferred_time, data.time_zone);
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({ requested_at: newAt })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
