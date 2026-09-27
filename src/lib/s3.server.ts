/**
 * Media storage for "Send It Later" recordings, backed by Supabase Storage
 * (bucket: `send-later`). Replaces the former Lovable-brokered S3 connector.
 *
 * The public function names (`s3Put`, `s3ReadUrl`) and the object-path scheme
 * are kept so existing callers in send-later.server.ts don't need to change.
 * Object paths look like `send-later/<userId>/<uuid>.<ext>`; the first path
 * segment is stripped to form the key inside the bucket.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "send-later";

/** Turn an `send-later/<userId>/<file>` object path into a bucket-relative key. */
function bucketKey(objectPath: string): string {
  const parts = objectPath.split("/");
  return parts[0] === BUCKET ? parts.slice(1).join("/") : objectPath;
}

/** Upload a file server-side using the service-role client (bypasses RLS). */
export async function s3Put(
  objectPath: string,
  data: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
) {
  let body: Blob;
  if (data instanceof Blob) {
    body = data;
  } else {
    // Copy into a fresh ArrayBuffer-backed view so the Blob part type is exact
    // (avoids the ArrayBufferLike / SharedArrayBuffer variance complaint).
    const src = data instanceof Uint8Array ? data : new Uint8Array(data);
    const copy = new Uint8Array(src.byteLength);
    copy.set(src);
    body = new Blob([copy], { type: contentType });
  }
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(bucketKey(objectPath), body, { contentType, upsert: false });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return objectPath;
}

/** Short-lived signed download URL for private playback. */
export async function s3ReadUrl(objectPath: string) {
  const expiresIn = 3600;
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(bucketKey(objectPath), expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`Storage sign error: ${error?.message ?? "no url"}`);
  }
  return { url: data.signedUrl, expiresIn };
}
