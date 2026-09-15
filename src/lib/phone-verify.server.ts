/**
 * Mobile number verification, own OTP implementation on top of raw Telnyx
 * messaging/voice (no Verify API, so no per-verification platform fee).
 *
 * Security properties:
 *  - codes are never stored in plaintext: sha256(salt + code)
 *  - 10 minute expiry, single use (consumed_at)
 *  - max 5 wrong attempts per code, then the code is burned
 *  - 60s resend cooldown and max 5 sends per number per hour
 *  - all reads/writes go through the service role; the browser only ever
 *    sends a phone number and a 6-digit code
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { telnyxConfig, pickSmsSender, type TelnyxConfig } from "@/lib/telnyx.server";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 3;
const MAX_ATTEMPTS = 5;

export type Channel = "sms" | "call";

export function normalizePhone(input: string, country?: string | null): string {
  const parsed = parsePhoneNumberFromString(
    input.trim(),
    (country?.toUpperCase() as never) ?? undefined,
  );
  if (!parsed?.isValid()) throw new Error("That mobile number doesn't look valid.");
  return parsed.number;
}

function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

function randomSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashCode(code: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * SMS is far cheaper than a voice call, so it is always preferred when a sender
 * exists that the destination will accept. India only accepts SMS from a
 * registered short code / sender ID, so without one we fall back to voice.
 */
function preferredChannel(cfg: TelnyxConfig, e164: string): Channel {
  if (!e164.startsWith("+91")) return "sms";
  return cfg.smsShortCode || cfg.smsAlphaSender ? "sms" : "call";
}

async function sendSms(cfg: TelnyxConfig, to: string, code: string) {
  const body: Record<string, unknown> = {
    from: pickSmsSender(cfg, to),
    to,
    // Kept under 160 GSM-7 characters so it always bills as a single segment.
    text: `SomeoneNear code: ${code}. Expires in 10 min. Do not share.`,
    type: "SMS",
  };
  if (cfg.messagingProfileId) body["messaging_profile_id"] = cfg.messagingProfileId;
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`otp sms failed [${res.status}]: ${text.slice(0, 300)}`);
    throw new Error("sms_failed");
  }
}

async function placeVoiceOtp(cfg: TelnyxConfig, to: string, code: string) {
  const res = await fetch("https://api.telnyx.com/v2/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connection_id: cfg.connectionId,
      to,
      from: cfg.callerId,
      // The code takes ~15s to read out; cap the leg so a stuck call can't bill on.
      timeout_secs: Math.min(cfg.ringSeconds, 25),
      time_limit_secs: 60,
      answering_machine_detection: "disabled",
      client_state: btoa(JSON.stringify({ v: 1, c: code })),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`otp voice call failed [${res.status}]: ${text.slice(0, 300)}`);
    throw new Error("call_failed");
  }
}

export async function startVerification(
  userId: string,
  rawPhone: string,
  country: string | null,
  channelOverride?: Channel,
): Promise<{ phone: string; channel: Channel; expiresAt: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cfg = telnyxConfig();
  if (!cfg) throw new Error("Verification is temporarily unavailable. Please try again later.");

  const phone = normalizePhone(rawPhone, country);
  const nowMs = Date.now();

  const { data: recent } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, last_sent_at, send_count, created_at")
    .eq("user_id", userId)
    .eq("phone", phone)
    .gte("created_at", new Date(nowMs - 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  const sendsThisHour = (recent ?? []).reduce((n, r) => n + (r.send_count ?? 1), 0);
  if (sendsThisHour >= MAX_SENDS_PER_HOUR) {
    throw new Error("Too many code requests. Please wait an hour and try again.");
  }
  const last = recent?.[0];
  if (last && nowMs - new Date(last.last_sent_at as string).getTime() < RESEND_COOLDOWN_MS) {
    throw new Error("A code was just sent. Please wait a minute before asking for another.");
  }

  const code = randomCode();
  const salt = randomSalt();
  const channel: Channel = channelOverride ?? preferredChannel(cfg, phone);

  let used: Channel = channel;
  try {
    if (channel === "sms") await sendSms(cfg, phone, code);
    else await placeVoiceOtp(cfg, phone, code);
  } catch (e) {
    // Fall back to the other channel once before giving up.
    const fallback: Channel = channel === "sms" ? "call" : "sms";
    try {
      if (fallback === "sms") await sendSms(cfg, phone, code);
      else await placeVoiceOtp(cfg, phone, code);
      used = fallback;
    } catch {
      console.error("otp delivery failed on both channels", e);
      throw new Error(
        "We couldn't reach that number right now. Please check it and try again in a moment.",
      );
    }
  }

  const expiresAt = new Date(nowMs + CODE_TTL_MS).toISOString();
  // Burn any older live codes for this user.
  await supabaseAdmin
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("consumed_at", null);

  const { error } = await supabaseAdmin.from("phone_verifications").insert({
    user_id: userId,
    phone,
    code_hash: await hashCode(code, salt),
    salt,
    channel: used,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  return { phone, channel: used, expiresAt };
}

export async function confirmVerification(
  userId: string,
  code: string,
  country: string | null,
): Promise<{ phone: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, phone, code_hash, salt, attempts, expires_at")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row) throw new Error("No active code. Please request a new one.");
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await supabaseAdmin
      .from("phone_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    throw new Error("That code has expired. Please request a new one.");
  }
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("phone_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    throw new Error("Too many wrong attempts. Please request a new code.");
  }

  const candidate = await hashCode(code.trim(), row.salt as string);
  if (!timingSafeEqual(candidate, row.code_hash as string)) {
    await supabaseAdmin
      .from("phone_verifications")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id);
    throw new Error("That code isn't right. Please try again.");
  }

  await supabaseAdmin
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  const { error: perr } = await supabaseAdmin
    .from("profiles")
    .update({
      phone: row.phone as string,
      phone_country: country ?? null,
      phone_verified: true,
    })
    .eq("id", userId);
  if (perr) throw new Error(perr.message);

  return { phone: row.phone as string };
}

/** Speaks the code on an answered verification call, then hangs up. */
export async function speakVerificationCode(callControlId: string, code: string) {
  const cfg = telnyxConfig();
  if (!cfg) return;
  const spoken = code.split("").join(", ");
  await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payload: `Hello from Someone Near. Your verification code is ${spoken}. Again, ${spoken}. Goodbye.`,
      voice: "female",
      language: "en-US",
    }),
  });
}

export async function hangupCall(callControlId: string) {
  const cfg = telnyxConfig();
  if (!cfg) return;
  await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
  });
}
