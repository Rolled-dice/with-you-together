// Web Crypto only (Cloudflare Worker safe). No Node APIs.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(keyMaterial: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(keyMaterial));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string, keyMaterial: string): Promise<string> {
  const key = await aesKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)),
  );
  return `${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function decryptSecret(payload: string, keyMaterial: string): Promise<string> {
  const [ivPart, ctPart] = payload.split(".");
  if (!ivPart || !ctPart) throw new Error("Malformed ciphertext");
  const key = await aesKey(keyMaterial);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64urlDecode(ivPart) },
    key,
    b64urlDecode(ctPart),
  );
  return dec.decode(pt);
}

async function hmacKey(keyMaterial: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(payload: object, keyMaterial: string, ttlMs = 600_000): Promise<string> {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const bodyB64 = b64urlEncode(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(keyMaterial);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(bodyB64)));
  return `${bodyB64}.${b64urlEncode(sig)}`;
}

export async function verifyState(token: string, keyMaterial: string): Promise<Record<string, unknown> | null> {
  const [bodyB64, sigB64] = token.split(".");
  if (!bodyB64 || !sigB64) return null;
  const key = await hmacKey(keyMaterial);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), enc.encode(bodyB64));
  if (!ok) return null;
  try {
    const body = JSON.parse(dec.decode(b64urlDecode(bodyB64))) as Record<string, unknown>;
    if (typeof body.exp === "number" && body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}
