/** Send It Later: scheduled text/voice/video messages with media stored on S3. */

import { s3Put, s3ReadUrl } from "@/lib/s3.server";

type Ctx = { supabase: any; userId: string };

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

  let s3Key: string | null = null;
  if (input.kind !== "text") {
    if (!input.file) throw new Error("Record or upload your message first");
    if (input.file.size > MAX_BYTES)
      throw new Error("File is too large — keep it under 25 MB");
    const ext = extFor(input.file.type);
    s3Key = `send-later/${context.userId}/${crypto.randomUUID()}.${ext}`;
    await s3Put(s3Key, await input.file.arrayBuffer(), input.file.type);
  } else if (!input.body?.trim()) {
    throw new Error("Write your message first");
  }

  const { data, error } = await context.supabase
    .from("scheduled_messages")
    .insert({
      user_id: context.userId,
      recipient_name: input.recipientName.trim(),
      recipient_user_id: input.recipientUserId ?? null,
      kind: input.kind,
      body: input.body?.trim() || null,
      s3_key: s3Key,
      media_duration_seconds: input.mediaDurationSeconds ?? null,
      scheduled_at: when.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
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
    .select("s3_key, user_id, recipient_user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (
    !data?.s3_key ||
    (data.user_id !== context.userId && data.recipient_user_id !== context.userId)
  )
    throw new Error("No recording found");
  return s3ReadUrl(data.s3_key);
}

/** Delivered messages addressed to the signed-in user. */
export async function listReceivedMessages(context: Ctx) {
  const { data, error } = await context.supabase
    .from("scheduled_messages")
    .select(
      "id, recipient_name, kind, body, s3_key, media_duration_seconds, scheduled_at, delivered_at, status, profiles:user_id(display_name)",
    )
    .eq("recipient_user_id", context.userId)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Family members the user can address a message to. */
export async function listFamilyContacts(context: Ctx) {
  const { data: famId, error: famErr } = await context.supabase.rpc(
    "get_user_family_id",
    { _uid: context.userId },
  );
  if (famErr || !famId) return [];
  const { data, error } = await context.supabase
    .from("family_members")
    .select("user_id, profiles:user_id(display_name)")
    .eq("family_id", famId)
    .neq("user_id", context.userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: any) => ({
    userId: m.user_id as string,
    name: (m.profiles?.display_name as string) || "Family member",
  }));
}
