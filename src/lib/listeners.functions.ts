import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
        "id, listener_id, requested_at, duration_minutes, note, status, listeners(name)",
      )
      .eq("user_id", context.userId)
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
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
  duration_minutes: z.number().int().min(15).max(120).default(45),
  note: z.string().max(1000).default(""),
  booking_type: z.enum(["scheduled", "emergency_callback"]).default("scheduled"),
});

function combineToUtc(day: string, time: string, timeZone: string): string {
  // Interpret day+time in the user's timezone and convert to a real UTC instant.
  // Uses Intl trick: build a Date that we believe is UTC, then figure the local offset.
  const iso = `${day}T${time.length === 5 ? time + ":00" : time}`;
  const naive = new Date(iso + "Z"); // pretend UTC
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(naive).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asIfTz = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asIfTz - naive.getTime();
  return new Date(naive.getTime() - offset).toISOString();
}

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
        throw new Error(
          "Calls must be booked at least 2 hours ahead so we can assign a listener. Please pick a later time.",
        );
      }
    }


    // Auto-assign: least-loaded active listener.
    const { data: listeners, error: lerr } = await context.supabase
      .from("listeners")
      .select("id")
      .eq("is_active", true);
    if (lerr) throw new Error(lerr.message);
    if (!listeners || listeners.length === 0) {
      throw new Error("Our team is at capacity right now. Please try another day.");
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
        duration_minutes:
          data.booking_type === "emergency_callback" ? 30 : data.duration_minutes,
        note: prefix + data.note,
        status: data.booking_type === "emergency_callback" ? "requested" : "confirmed",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id };
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
      // Mark original as used so ops can reallocate the freed slot.
      await context.supabase
        .from("listener_bookings")
        .update({ status: "completed", note: "[USED_BY_LATE_RESCHEDULE]" })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      throw new Error(
        "Reschedules must be made at least 2 hours before your session. This session has been marked used so our team can reallocate the slot.",
      );
    }
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
