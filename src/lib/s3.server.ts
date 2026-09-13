/** AWS S3 storage helpers via the Lovable connector gateway (bucket: someonenear). */

const GATEWAY = "https://connector-gateway.lovable.dev";

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const s3 = process.env["AWS_S3_API_KEY"];
  if (!lovable || !s3) throw new Error("S3 storage is not connected yet");
  return { lovable, s3 };
}

async function signUrl(mode: "read" | "write", objectPath: string) {
  const { lovable, s3 } = keys();
  const res = await fetch(
    `${GATEWAY}/api/v1/sign_storage_url?provider=aws_s3&mode=${mode}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": s3,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ object_path: objectPath }),
    },
  );
  if (!res.ok) {
    throw new Error(`S3 sign error [${res.status}]: ${await res.text()}`);
  }
  const { url, expires_in } = await res.json();
  return { url: url as string, expiresIn: expires_in as number };
}

/** Upload a file server-side (avoids browser CORS requirements). */
export async function s3Put(
  objectPath: string,
  data: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
) {
  const { url } = await signUrl("write", objectPath);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: data as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`S3 upload failed [${res.status}]: ${await res.text()}`);
  }
  return objectPath;
}

/** Short-lived download URL for private playback. */
export async function s3ReadUrl(objectPath: string) {
  return signUrl("read", objectPath);
}
