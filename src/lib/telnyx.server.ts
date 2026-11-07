/**
 * Telnyx voice layer.
 *
 * Model: the agent talks in the browser over WebRTC (a SIP credential leg) and
 * the member is dialled on their phone over PSTN. The two legs are bridged by
 * Telnyx Call Control, driven by webhook events.
 *
 * Every function here is server-only: the API key never reaches the browser.
 */

const API = "https://api.telnyx.com/v2";

export type TelnyxConfig = {
  apiKey: string;
  connectionId: string;
  callerId: string;
  credentialId: string | null;
  /** Optional short code (e.g. 12345), cheapest per-message route where enabled. */
  smsShortCode: string | null;
  /** Optional alphanumeric sender ID (e.g. "SomeNear"), free sender, no number rental. */
  smsAlphaSender: string | null;
  /** Messaging profile that owns the sending route. */
  messagingProfileId: string | null;
  /** Recording is billed per minute plus storage, OFF by default. */
  recordCalls: boolean;
  /** Hard cap so a forgotten open line can never bill indefinitely. */
  maxCallSeconds: number;
  /** How long we ring before giving up (shorter = fewer wasted attempts). */
  ringSeconds: number;
};

export function telnyxConfig(): TelnyxConfig | null {
  const apiKey = process.env["TELNYX_API_KEY"]?.trim();
  const connectionId = process.env["TELNYX_CALL_CONTROL_APP_ID"]?.trim();
  let callerId = process.env["TELNYX_PHONE_NUMBER"]?.trim();
  if (!apiKey || !connectionId || !callerId) return null;
  // Normalize to E.164. Accept +1 315-997-8334, (315) 997-8334, etc.
  const digits = callerId.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    callerId = `+${digits}`;
  } else if (digits.length === 10) {
    callerId = `+1${digits}`;
  } else if (!callerId.startsWith("+")) {
    callerId = `+${digits}`;
  }
  return {
    apiKey,
    connectionId,
    callerId,
    credentialId: process.env["TELNYX_SIP_CREDENTIAL_ID"]?.trim() ?? null,
    smsShortCode: process.env["TELNYX_SMS_SHORT_CODE"]?.replace(/\D/g, "") || null,
    smsAlphaSender: process.env["TELNYX_SMS_SENDER_ID"]?.trim() || null,
    messagingProfileId: process.env["TELNYX_MESSAGING_PROFILE_ID"]?.trim() || null,
    // Set to "true" to turn call recording back on. Default is "false" to save cost.
    recordCalls: (process.env["TELNYX_RECORD_CALLS"] ?? "false").trim().toLowerCase() === "true",
    maxCallSeconds: positiveInt(process.env["TELNYX_MAX_CALL_SECONDS"], 1800),
    ringSeconds: positiveInt(process.env["TELNYX_RING_SECONDS"], 25),
  };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Cheapest usable sender for a destination, in order:
 *  1. short code, lowest per-message rate and best deliverability where provisioned
 *  2. alphanumeric sender ID, no number rental cost (not allowed in US/CA/IN)
 *  3. the long code we already rent
 */
export function pickSmsSender(cfg: TelnyxConfig, to: string): string {
  const isNanp = to.startsWith("+1");
  const isIndia = to.startsWith("+91");
  if (cfg.smsShortCode && (isNanp || isIndia)) return cfg.smsShortCode;
  if (cfg.smsShortCode) return cfg.smsShortCode;
  if (cfg.smsAlphaSender && !isNanp && !isIndia) return cfg.smsAlphaSender;
  return cfg.callerId;
}

async function telnyx<T>(
  cfg: TelnyxConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Telnyx ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Error(`Telnyx request failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/** Short-lived JWT the browser softphone uses to register. */
export async function mintAgentToken(cfg: TelnyxConfig) {
  if (!cfg.credentialId) throw new Error("TELNYX_SIP_CREDENTIAL_ID is not configured");
  // Telnyx returns the token as a raw JWT string (text/plain), not JSON.
  const res = await fetch(`${API}/telephony_credentials/${cfg.credentialId}/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const text = (await res.text()).trim();
  if (!res.ok) {
    console.error(`Telnyx token mint failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Error(`Telnyx token mint failed [${res.status}]`);
  }
  // Accept either a raw JWT or a JSON envelope, depending on API version.
  let token = text;
  if (text.startsWith("{")) {
    const out = JSON.parse(text) as { data?: { token?: string }; token?: string };
    token = out.data?.token ?? out.token ?? "";
  }
  if (!token.startsWith("eyJ")) throw new Error("Telnyx did not return a softphone token");
  return token;
}

/** SIP URI of the agent softphone credential, used as the agent call leg. */
export async function agentSipUri(cfg: TelnyxConfig) {
  if (!cfg.credentialId) throw new Error("TELNYX_SIP_CREDENTIAL_ID is not configured");
  const out = await telnyx<{ data: { sip_username: string } }>(
    cfg,
    `/telephony_credentials/${cfg.credentialId}`,
  );
  return `sip:${out.data.sip_username}@sip.telnyx.com`;
}

type DialResult = {
  data: { call_control_id: string; call_session_id: string; call_leg_id: string };
};

/** Places an outbound leg. `to` is a phone number or SIP URI. */
export async function dial(
  cfg: TelnyxConfig,
  to: string,
  opts: {
    bookingId?: string;
    familyInvitationId?: string;
    verificationSessionId?: string;
    legRole: "agent" | "member";
    sessionId?: string | null;
  },
) {
  const clientState = opts.bookingId
    ? { b: opts.bookingId, r: opts.legRole }
    : { f: opts.familyInvitationId, s: opts.verificationSessionId, r: opts.legRole };
  const body: Record<string, unknown> = {
    connection_id: cfg.connectionId,
    to,
    from: cfg.callerId,
    client_state: btoa(JSON.stringify(clientState)),
    // Short ring window, no answering-machine detection (billed extra) and a
    // hard time limit so no leg can ever run up minutes unattended.
    timeout_secs: cfg.ringSeconds,
    time_limit_secs: cfg.maxCallSeconds,
    answering_machine_detection: "disabled",
  };
  if (opts.sessionId) body["link_to"] = opts.sessionId;
  const out = await telnyx<DialResult>(cfg, "/calls", { method: "POST", body });
  return out.data;
}

export async function bridge(cfg: TelnyxConfig, callControlId: string, otherControlId: string) {
  await telnyx(cfg, `/calls/${callControlId}/actions/bridge`, {
    method: "POST",
    body: { call_control_id: otherControlId },
  });
}

export async function hangup(cfg: TelnyxConfig, callControlId: string) {
  await telnyx(cfg, `/calls/${callControlId}/actions/hangup`, { method: "POST" });
}

/** Single-channel mp3, half the storage of dual, and enough for review. */
export async function startRecording(cfg: TelnyxConfig, callControlId: string) {
  if (!cfg.recordCalls) return;
  await telnyx(cfg, `/calls/${callControlId}/actions/record_start`, {
    method: "POST",
    body: { format: "mp3", channels: "single" },
  });
}

export async function transfer(cfg: TelnyxConfig, callControlId: string, to: string) {
  await telnyx(cfg, `/calls/${callControlId}/actions/transfer`, {
    method: "POST",
    body: { to, from: cfg.callerId },
  });
}

/** Verifies the Ed25519 signature Telnyx puts on every webhook. */
export async function verifyTelnyxSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): Promise<boolean> {
  const publicKey = process.env["TELNYX_PUBLIC_KEY"];
  if (!publicKey || !signature || !timestamp) return false;
  // Reject replays older than 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  try {
    const keyBytes = base64ToBytes(publicKey);
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, [
      "verify",
    ]);
    const data = new TextEncoder().encode(`${timestamp}|${rawBody}`);
    return await crypto.subtle.verify("Ed25519", key, base64ToBytes(signature), data);
  } catch (e) {
    console.error("telnyx signature verification unavailable", e);
    return false;
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodeClientState(
  state?: string | null,
): { b?: string; f?: string; s?: string; r?: string } {
  if (!state) return {};
  try {
    return JSON.parse(atob(state)) as { b?: string; r?: string };
  } catch {
    return {};
  }
}
