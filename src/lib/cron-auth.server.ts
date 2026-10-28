export async function isAuthorizedCronRequest(request: Request): Promise<boolean> {
  const secret = process.env.CRON_HOOK_SECRET;
  if (
    !secret ||
    !/^[\x21-\x7e]{32,1024}$/.test(secret) ||
    secret.includes("REPLACE_") ||
    secret === process.env.SUPABASE_ANON_KEY ||
    secret === process.env.SUPABASE_PUBLISHABLE_KEY ||
    secret.startsWith("sb_publishable_")
  )
    return false;

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const supplied = bearer ?? request.headers.get("apikey");
  if (!supplied || supplied.length > 1024) return false;

  const encoder = new TextEncoder();
  const expectedHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  );
  const suppliedHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  );
  let difference = 0;
  for (let i = 0; i < expectedHash.length; i++) difference |= expectedHash[i] ^ suppliedHash[i];
  return difference === 0;
}
