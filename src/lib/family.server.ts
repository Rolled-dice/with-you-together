import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { FamilyInviteRow, FamilySnapshot, VerificationQueue } from "./family.schemas";
import { FAMILY_AVATARS } from "./family-avatars";

type FamilyDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      family_command: { Args: { p_actor: string; p_action: string; p_data: Json }; Returns: Json };
      family_reminder_command: {
        Args: { p_actor: string; p_action: string; p_data: Json };
        Returns: Json;
      };
      call_credit_command: {
        Args: { p_actor: string; p_action: string; p_data: Json };
        Returns: Json;
      };
    };
  };
};
// Local RPC contract for additive migrations; generated Supabase types stay untouched.
const db = supabaseAdmin as unknown as SupabaseClient<FamilyDatabase>;
export async function familyCommand(actor: string, action: string, payload: Json = {}) {
  const { data, error } = await db.rpc("family_command", {
    p_actor: actor,
    p_action: action,
    p_data: payload,
  });
  if (error)
    throw new Error(
      error.code === "P0001" ? error.message : "Family service is unavailable. Please try again.",
    );
  return data;
}
export async function familyReminderCommand(actor: string, action: string, payload: Json = {}) {
  const { data, error } = await db.rpc("family_reminder_command", {
    p_actor: actor,
    p_action: action,
    p_data: payload,
  });
  if (error)
    throw new Error(
      error.code === "P0001" ? error.message : "Reminders are unavailable. Please try again.",
    );
  return data;
}
export async function callCreditCommand(actor: string, action: string, payload: Json = {}) {
  const { data, error } = await db.rpc("call_credit_command", {
    p_actor: actor,
    p_action: action,
    p_data: payload,
  });
  if (error)
    throw new Error(
      error.code === "P0001" ? error.message : "Call balance is unavailable. Please try again.",
    );
  return data;
}
export async function familySnapshot(actor: string) {
  const snapshot = FamilySnapshot.parse(await familyCommand(actor, "snapshot"));
  if (!snapshot.members.length) return snapshot;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, avatar_url")
    .in(
      "id",
      snapshot.members.map((member) => member.user_id),
    );
  if (error) throw new Error("Family profiles could not be loaded. Please try again.");
  // Only built-in family portraits are shared, never external profile-photo URLs.
  const avatars = new Map(data.map((profile) => [profile.id, profile.avatar_url]));
  return {
    ...snapshot,
    members: snapshot.members.map((member) => {
      const avatar = avatars.get(member.user_id);
      return { ...member, avatar_url: avatar && FAMILY_AVATARS.includes(avatar) ? avatar : null };
    }),
  };
}
export async function verificationQueue(actor: string) {
  return VerificationQueue.parse(await familyCommand(actor, "verification_queue"));
}
export async function lookupFamilyInvite(actor: string, payload: { token: string }) {
  return FamilyInviteRow.extend({
    family_name: z.string(),
    call_phone: z.string().nullable(),
  }).parse(await familyCommand(actor, "lookup", payload));
}
export function familyDeliveryConfig() {
  return {
    email: Boolean(
      process.env.BREVO_API_KEY &&
      (process.env.FAMILY_EMAIL_FROM || process.env.CALENDAR_ORGANIZER_EMAIL),
    ),
    smsIndia: process.env.FAMILY_SMS_ENABLED_IN === "true",
    smsUS: process.env.FAMILY_SMS_ENABLED_US === "true",
    phoneLogin: process.env.FAMILY_PHONE_LOGIN_ENABLED === "true",
  };
}
export async function deliverFamilyInvite(actor: string, id: string) {
  const invite = z
    .object({
      id: z.string(),
      token: z.string(),
      email: z.string().nullable(),
      contact_phone: z.string().nullable(),
      contact_channel: z.enum(["email", "sms"]),
      family_name: z.string(),
      last_sent_at: z.string(),
    })
    .parse(await familyCommand(actor, "delivery_claim", { id }));
  let sent = false;
  try {
    const link = new URL("/invite", process.env.APP_URL || "https://www.someonenear.com");
    link.searchParams.set("token", invite.token);
    const text = `You have been invited to a SomeoneNear family. Review the invitation and choose what you share: ${link}. Joining is your choice. Ignore this message if unexpected.`;
    if (invite.contact_channel === "email") {
      if (!familyDeliveryConfig().email) throw new Error("Email delivery is not configured.");
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: {
            name: "SomeoneNear",
            email: process.env.FAMILY_EMAIL_FROM || process.env.CALENDAR_ORGANIZER_EMAIL,
          },
          to: [{ email: invite.email }],
          subject: "Your SomeoneNear family invitation",
          textContent: text,
          headers: { idempotencyKey: `family-${id}-${invite.last_sent_at}` },
        }),
      });
      if (!response.ok) throw new Error("Email delivery failed.");
    } else {
      await sendFamilySms(invite.contact_phone!, text);
    }
    sent = true;
  } catch {
    console.warn("[family-invite] delivery failed", {
      invitationId: id,
      channel: invite.contact_channel,
    });
  }
  await familyCommand(actor, "delivery_result", { id, sent });
  return { id, delivery_status: sent ? ("sent" as const) : ("failed" as const) };
}
export async function sendFamilySms(to: string, text: string) {
  const config = familyDeliveryConfig();
  const country = parsePhoneNumberFromString(to)?.country;
  if (!((country === "IN" && config.smsIndia) || (country === "US" && config.smsUS)))
    throw new Error("SMS delivery is not enabled for this destination yet.");
  const { telnyxConfig, pickSmsSender } = await import("./telnyx.server");
  const telnyx = telnyxConfig();
  if (!telnyx) throw new Error("SMS delivery is unavailable.");
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${telnyx.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: pickSmsSender(telnyx, to),
      to,
      text,
      type: "SMS",
      messaging_profile_id: telnyx.messagingProfileId || undefined,
    }),
  });
  if (!response.ok) throw new Error("SMS delivery failed.");
}
