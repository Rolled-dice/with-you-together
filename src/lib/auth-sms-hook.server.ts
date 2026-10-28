import { z } from "zod";
import { FamilyPhone } from "./family.schemas";
import { sendFamilySms } from "./family.server";

export async function verifySmsHook(
  body: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (
    !id ||
    id.length > 200 ||
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !signatures ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    body.length > 16384
  )
    return false;
  try {
    const bytes = Uint8Array.from(atob(secret.replace(/^v1,/, "").replace(/^whsec_/, "")), (char) =>
      char.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const payload = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
    for (const signature of signatures.split(" ")) {
      if (!signature.startsWith("v1,")) continue;
      const mac = Uint8Array.from(atob(signature.slice(3)), (char) => char.charCodeAt(0));
      if (await crypto.subtle.verify("HMAC", key, mac, payload)) return true;
    }
  } catch {
    return false;
  }
  return false;
}
export async function handleSmsHook(request: Request) {
  const secret = process.env.SUPABASE_SEND_SMS_HOOK_SECRET;
  if (!secret || process.env.FAMILY_PHONE_LOGIN_ENABLED !== "true")
    return Response.json({ error: { message: "Phone sign-in is not enabled." } }, { status: 503 });
  const body = await request.text();
  if (!(await verifySmsHook(body, request.headers, secret)))
    return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });
  try {
    const payload = z
      .object({
        user: z.object({ phone: z.string() }),
        sms: z.object({ otp: z.string().regex(/^\d{6}$/) }),
      })
      .parse(JSON.parse(body));
    const phone = FamilyPhone.parse(`+${payload.user.phone.replace(/^\+/, "")}`);
    await sendFamilySms(
      phone,
      `Your SomeoneNear sign-in code is ${payload.sms.otp}. Do not share this code.`,
    );
    return Response.json({});
  } catch {
    return Response.json(
      { error: { http_code: 503, message: "The sign-in code could not be delivered." } },
      { status: 503 },
    );
  }
}
