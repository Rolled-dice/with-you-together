/** Dedicated scheduler credentials; public Supabase API keys never authorize jobs. */
export async function schedulerAuthorized(request: Request, expected: string | undefined) {
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || expected.length < 32 || !provided) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [expected, provided].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}
