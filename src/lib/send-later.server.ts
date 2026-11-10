/** Send It Later: scheduled text/voice/video messages with media stored in private Supabase Storage. */

import {
  putSendLaterMedia,
  signSendLaterMedia,
  removeSendLaterMedia,
} from "@/lib/media-storage.server";
import { mediaFile } from "@/features/media/recording";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
type Ctx = { supabase: SupabaseClient<Database>; userId: string };

const MAX_BYTES = 25 * 1024 * 1024;

function extFor(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

export async function createScheduledMessage(
  context: Ctx,
  input: {
    recipientName: string;
    recipientUserId?: string | null;
    kind: "text" | "voice" | "video";
    body?: string;
    scheduledAt: string;
    file?: File | null;
    mediaDurationSeconds?: number | null;
  },
) {
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time");
  if (when.getTime() < Date.now() + 60_000)
    throw new Error("Choose a time at least a few minutes in the future");
  const recipientUserId = input.recipientUserId || context.userId;
  const isSelf = recipientUserId === context.userId;
  if (!isSelf) {
    const contacts = await listFamilyContacts(context);
    if (!contacts.some((contact) => contact.userId === recipientUserId)) {
      throw new Error("Choose someone in your family circle.");
    }
  }

  let s3Key: string | null = null;
  if (input.kind !== "text") {
    if (!input.file) throw new Error("Record or upload your message first");
    if (input.file.size > MAX_BYTES) throw new Error("File is too large, keep it under 25 MB");
    const ext = extFor(input.file.type);
    // The database guard retains the logical bucket prefix; Storage itself uses owner/file.
    s3Key =
      "send-later/" +
      (await putSendLaterMedia(
        context.supabase,
        `${context.userId}/${crypto.randomUUID()}.${ext}`,
        context.userId,
        mediaFile(input.file, input.kind),
      ));
  } else if (!input.body?.trim()) {
    throw new Error("Write your message first");
  }

  const { data, error } = await context.supabase
    .from("scheduled_messages")
    .insert({
      user_id: context.userId,
      recipient_name: (input.recipientName || "").trim() || (isSelf ? "You (Future Self)" : "Family Member"),
      recipient_user_id: recipientUserId,
      kind: input.kind,
      body: input.body?.trim() || null,
      s3_key: s3Key,
      media_duration_seconds: input.mediaDurationSeconds ?? null,
      scheduled_at: when.toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (s3Key)
      try {
        await removeSendLaterMedia(context.supabase, s3Key, context.userId);
      } catch {
        console.error("[send-later] Upload cleanup failed");
      }
    throw new Error(error.message);
  }
  return { id: data.id as string };
}

export async function listScheduledMessages(context: Ctx) {
  const { data, error } = await context.supabase
    .from("scheduled_messages")
    .select(
      "id, recipient_name, kind, body, s3_key, media_duration_seconds, scheduled_at, status, created_at",
    )
    .eq("user_id", context.userId)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function cancelScheduledMessage(context: Ctx, id: string) {
  const { error } = await context.supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", context.userId)
    .eq("status", "scheduled");
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Signed playback URL for the owner or the recipient. */
export async function getMediaUrl(context: Ctx, id: string) {
  const { data, error } = await context.supabase
    .from("scheduled_messages")
    .select("s3_key, user_id, recipient_user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (
    !data?.s3_key ||
    (data.user_id !== context.userId && data.recipient_user_id !== context.userId)
  )
    throw new Error("No recording found");
  if (data.user_id !== context.userId && data.status !== "delivered")
    throw new Error("This message has not arrived yet");
  return signSendLaterMedia(data.s3_key, data.user_id);
}

/** Delivered messages addressed to the signed-in user. */
export async function listReceivedMessages(context: Ctx) {
  const { data, error } = await context.supabase
    .from("scheduled_messages")
    .select(
      "id, user_id, recipient_name, kind, body, s3_key, media_duration_seconds, scheduled_at, delivered_at, status",
    )
    .eq("recipient_user_id", context.userId)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const senderIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (senderIds.length) {
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", senderIds);
    for (const p of profs ?? []) names.set(p.id as string, (p.display_name as string) ?? "");
  }
  return rows.map((r) => ({
    ...r,
    profiles: { display_name: names.get(r.user_id) || null },
  }));
}

/** Family members and future self the user can address a message or time capsule to. */
export async function listFamilyContacts(context: Ctx) {
  const selfContact = {
    userId: context.userId,
    name: "You (Future Self · Time Capsule)",
  };
  const { data: famId, error: famErr } = await context.supabase.rpc("get_user_family_id", {
    _uid: context.userId,
  });
  if (famErr || !famId) return [selfContact];
  const { data, error } = await context.supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", famId)
    .neq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((m) => m.user_id as string);
  if (!ids.length) return [selfContact];
  const { data: profs } = await context.supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const names = new Map<string, string>(
    (profs ?? []).map((p) => [p.id as string, p.display_name as string]),
  );
  const family = ids.map((id: string) => ({
    userId: id,
    name: names.get(id) || "Family member",
  }));
  return [selfContact, ...family];
}
