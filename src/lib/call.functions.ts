import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BookingIdInput = z.object({ booking_id: z.string().uuid() });


export const getCallState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookingIdInput.parse(i))
  .handler(async ({ context, data }) => {
    const { data: b, error } = await context.supabase
      .from("listener_bookings")
      .select(
        "id, status, requested_at, duration_minutes, room_name, ready_user, ready_listener, recording_consent_user, recording_consent_listener, call_started_at, call_ended_at, rating, feedback_note, feedback_at, follow_up_wanted, listeners(name)",
      )
      .eq("id", data.booking_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Booking not found");
    return b;
  });

export const setReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingIdInput.extend({
      role: z.enum(["user", "listener"]),
      ready: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const patch =
      data.role === "user"
        ? { ready_user: data.ready }
        : { ready_listener: data.ready };
    const { error } = await context.supabase
      .from("listener_bookings")
      .update(patch)
      .eq("id", data.booking_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRecordingConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingIdInput.extend({
      role: z.enum(["user", "listener"]),
      consent: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const patch =
      data.role === "user"
        ? { recording_consent_user: data.consent }
        : { recording_consent_listener: data.consent };
    const { error } = await context.supabase
      .from("listener_bookings")
      .update(patch)
      .eq("id", data.booking_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function mintToken(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  role: "user" | "listener";
  roomName: string;
  ttlSeconds: number;
}) {
  const { AccessToken } = await import("livekit-server-sdk");
  const at = new AccessToken(opts.apiKey, opts.apiSecret, {
    identity: opts.identity,
    name: opts.role === "user" ? "You" : "Listener",
    ttl: opts.ttlSeconds,
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();
  const expiresAt = Date.now() + opts.ttlSeconds * 1000;
  return { token, expiresAt };
}

const TOKEN_TTL_SECONDS = 60 * 60;

export const getCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingIdInput.extend({ role: z.enum(["user", "listener"]) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      throw new Error("LiveKit not configured");
    }

    const { data: b, error } = await context.supabase
      .from("listener_bookings")
      .select(
        "id, user_id, ready_user, ready_listener, room_name, call_started_at, call_ended_at",
      )
      .eq("id", data.booking_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Booking not found");
    if (b.call_ended_at) throw new Error("This session has ended");
    if (!b.ready_user || !b.ready_listener) {
      throw new Error("Both parties must mark ready before joining");
    }

    let roomName = b.room_name;
    if (!roomName) {
      roomName = `besideu-${b.id}`;
      const patch: { room_name: string; call_started_at?: string } = {
        room_name: roomName,
      };
      if (!b.call_started_at) patch.call_started_at = new Date().toISOString();
      await context.supabase
        .from("listener_bookings")
        .update(patch)
        .eq("id", b.id);
    }

    const identity = `${data.role}-${context.userId}`;
    const { token, expiresAt } = await mintToken({
      apiKey,
      apiSecret,
      identity,
      role: data.role,
      roomName,
      ttlSeconds: TOKEN_TTL_SECONDS,
    });
    return { token, url, room: roomName, identity, expiresAt };
  });

export const refreshCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingIdInput.extend({ role: z.enum(["user", "listener"]) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      throw new Error("LiveKit not configured");
    }
    const { data: b, error } = await context.supabase
      .from("listener_bookings")
      .select("id, room_name, call_ended_at")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Booking not found");
    if (b.call_ended_at) throw new Error("This session has ended");
    if (!b.room_name) throw new Error("Room not initialized");

    const identity = `${data.role}-${context.userId}`;
    const { token, expiresAt } = await mintToken({
      apiKey,
      apiSecret,
      identity,
      role: data.role,
      roomName: b.room_name,
      ttlSeconds: TOKEN_TTL_SECONDS,
    });
    return { token, url, room: b.room_name, identity, expiresAt };
  });

export const endCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookingIdInput.parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("listener_bookings")
      .update({ call_ended_at: new Date().toISOString(), status: "completed" })
      .eq("id", data.booking_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitSessionFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    BookingIdInput.extend({
      rating: z.number().int().min(1).max(5),
      note: z.string().max(2000).optional().default(""),
      follow_up: z.boolean().optional().default(false),
    }).parse(i),
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
      .eq("id", data.booking_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
