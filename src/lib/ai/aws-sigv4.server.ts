/**
 * Lightweight, Edge-Compatible AWS Signature Version 4 (SigV4) Signer.
 * Uses Web Crypto (crypto.subtle) without heavy Node SDK dependencies.
 * Works seamlessly in Cloudflare Workers isolates and Node.js test runners.
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export function getAwsCredentials(): AwsCredentials | null {
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  const sessionToken = (process.env.AWS_SESSION_TOKEN || "").trim() || undefined;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return { accessKeyId, secretAccessKey, sessionToken };
}

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? new Uint8Array(key).buffer : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode(`AWS4${key}`), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  return hmacSha256(kService, "aws4_request");
}

export async function signAwsRequest({
  method,
  url,
  region,
  service,
  headers,
  body,
  credentials,
}: {
  method: string;
  url: string;
  region: string;
  service: string;
  headers: Record<string, string>;
  body: string;
  credentials?: AwsCredentials;
}): Promise<Record<string, string>> {
  const creds = credentials || getAwsCredentials();
  if (!creds) {
    throw new Error("[aws-sigv4] AWS credentials are not configured.");
  }

  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  const canonicalHeadersMap: Record<string, string> = {
    host: parsedUrl.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  if (creds.sessionToken) {
    canonicalHeadersMap["x-amz-security-token"] = creds.sessionToken;
  }

  for (const [k, v] of Object.entries(headers)) {
    canonicalHeadersMap[k.toLowerCase()] = v.trim();
  }

  const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${canonicalHeadersMap[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    method.toUpperCase(),
    parsedUrl.pathname || "/",
    parsedUrl.search ? parsedUrl.search.slice(1) : "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSignatureKey(creds.secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    Host: parsedUrl.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...(creds.sessionToken ? { "x-amz-security-token": creds.sessionToken } : {}),
    Authorization: authorizationHeader,
  };
}
