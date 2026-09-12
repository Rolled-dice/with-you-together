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
};

export function telnyxConfig(): TelnyxConfig | null {
  const apiKey = process.env["TELNYX_API_KEY"];
  const connectionId = process.env["TELNYX_CALL_CONTROL_APP_ID"];
  const callerId = process.env["TELNYX_PHONE_NUMBER"];
  if (!apiKey || !connectionId || !callerId) return null;
  return {
    apiKey,
    connectionId,
    callerId,
    credentialId: process.env["TELNYX_SIP_CREDENTIAL_ID"] ?? null,
  };
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
  const out = await telnyx<{ data: { token?: string } } | { token?: string }>(
    cfg,
    `/telephony_credentials/${cfg.credentialId}/token`,
    { method: "POST" },
  );
  const token =
    (out as { data?: { token?: string } }).data?.token ?? (out as { token?: string }).token;
  if (!token) throw new Error("Telnyx did not return a softphone token");
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
  opts: { bookingId: string; legRole: "agent" | "member"; sessionId?: string | null },
) {
  const body: Record<string, unknown> = {
    connection_id: cfg.connectionId,
    to,
    from: cfg.callerId,
    client_state: btoa(JSON.stringify({ b: opts.bookingId, r: opts.legRole })),
    timeout_secs: 45,
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

export async function startRecording(cfg: TelnyxConfig, callControlId: string) {
  await telnyx(cfg, `/calls/${callControlId}/actions/record_start`, {
    method: "POST",
    body: { format: "mp3", channels: "dual" },
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

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodeClientState(state?: string | null): { b?: string; r?: string } {
  if (!state) return {};
  try {
    return JSON.parse(atob(state)) as { b?: string; r?: string };
  } catch {
    return {};
  }
}
