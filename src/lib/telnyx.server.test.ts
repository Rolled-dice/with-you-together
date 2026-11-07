import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeClientState, dial, type TelnyxConfig } from "@/lib/telnyx.server";

const config: TelnyxConfig = {
  apiKey: "test-key",
  connectionId: "test-connection",
  callerId: "+13159970000",
  credentialId: "test-credential",
  smsShortCode: null,
  smsAlphaSender: null,
  messagingProfileId: null,
  recordCalls: false,
  maxCallSeconds: 1800,
  ringSeconds: 25,
};

afterEach(() => vi.unstubAllGlobals());

describe("Telnyx call metadata", () => {
  it("keeps listener booking call state compatible", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ data: { call_control_id: "call-1", call_session_id: "session-1" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await dial(config, "sip:agent@sip.telnyx.com", { bookingId: "booking-1", legRole: "agent" });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(decodeClientState(request.client_state)).toEqual({ b: "booking-1", r: "agent" });
  });

  it("tags family verification legs with their invitation and session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ data: { call_control_id: "call-2", call_session_id: "session-2" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await dial(config, "+13155550123", {
      familyInvitationId: "invite-1",
      verificationSessionId: "session-2",
      legRole: "member",
      sessionId: "telnyx-session-2",
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(decodeClientState(request.client_state)).toEqual({
      f: "invite-1",
      s: "session-2",
      r: "member",
    });
    expect(request.link_to).toBe("telnyx-session-2");
  });
});
