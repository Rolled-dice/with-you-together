import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
export function sendLaterStoragePath(key: string, ownerId: string) {
  z.string().uuid().parse(ownerId);
  const path = key.startsWith("send-later/") ? key.slice("send-later/".length) : key;
  const [owner, file, ...rest] = path.split("/");
  if (
    owner !== ownerId ||
    !file ||
    file === "." ||
    file === ".." ||
    rest.length ||
    /[\\?#]/.test(file)
  )
    throw new Error("No recording found");
  return path;
}
export async function putSendLaterMedia(
  client: SupabaseClient,
  path: string,
  ownerId: string,
  file: File,
) {
  const objectPath = sendLaterStoragePath(path, ownerId);
  const { error } = await client.storage
    .from("send-later")
    .upload(objectPath, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("We could not upload your recording. Please try again.");
  return objectPath;
}
export async function removeSendLaterMedia(client: SupabaseClient, path: string, ownerId: string) {
  const { error } = await client.storage
    .from("send-later")
    .remove([sendLaterStoragePath(path, ownerId)]);
  if (error) throw new Error("We could not clean up the recording.");
}
export async function signSendLaterMedia(path: string, ownerId: string) {
  const expiresIn = 300;
  const { data, error } = await supabaseAdmin.storage
    .from("send-later")
    .createSignedUrl(sendLaterStoragePath(path, ownerId), expiresIn);
  if (error || !data?.signedUrl) throw new Error("We could not open this recording.");
  return { url: data.signedUrl, expiresIn };
}
