import { afterEach, describe, expect, it, vi } from "vitest";
import {
  sendFamilyInvitationEmail,
  sendFamilyInvitationSupportAlert,
} from "@/lib/family-invitation-email.server";

const invitation = {
  to: "member@example.com",
  familyName: "The Rivera Family",
  inviterName: "Alex Rivera",
  role: "adult" as const,
  inviteUrl: "https://www.someonenear.com/invite?token=test-token",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendFamilyInvitationEmail", () => {
  it("sends a branded invite through Brevo with a plain-text fallback", async () => {
    vi.stubEnv("BREVO_API_KEY", "brevo-test-key");
    vi.stubEnv("FAMILY_EMAIL_FROM", "care@someonenear.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFamilyInvitationEmail(invitation)).resolves.toBe(true);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(new Headers(request.headers).get("api-key")).toBe("brevo-test-key");
    const body = JSON.parse(String(request.body));
    expect(body.to).toEqual([{ email: "member@example.com" }]);
    expect(body.sender.email).toBe("care@someonenear.com");
    expect(body.htmlContent).toContain("The Rivera Family");
    expect(body.htmlContent).toContain("test-token");
    expect(body.textContent).toContain("Alex Rivera invited you");
  });

  it("reports missing provider configuration without making a request", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFamilyInvitationEmail(invitation)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the approved invitation stage without asking the invitee to re-consent", async () => {
    vi.stubEnv("BREVO_API_KEY", "brevo-test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFamilyInvitationEmail({ ...invitation, approved: true })).resolves.toBe(true);

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.subject).toContain("approved");
    expect(body.textContent).toContain("is approved");
    expect(body.textContent).not.toContain("accept the invitation");
  });

  it("reports provider and network failures without exposing provider details", async () => {
    vi.stubEnv("BREVO_API_KEY", "brevo-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rejected", { status: 503 })));
    await expect(sendFamilyInvitationEmail(invitation)).resolves.toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
    await expect(sendFamilyInvitationEmail(invitation)).resolves.toBe(false);
  });
});

describe("sendFamilyInvitationSupportAlert", () => {
  it("alerts SomeoneNear support when consent is declined", async () => {
    vi.stubEnv("BREVO_API_KEY", "brevo-test-key");
    vi.stubEnv("FAMILY_EMAIL_FROM", "care@someonenear.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendFamilyInvitationSupportAlert({
        familyName: "The Rivera Family",
        inviteeName: "Sam Rivera",
        inviteePhone: "+919876543210",
        ownerName: "Alex Rivera",
        ownerEmail: "alex@example.com",
        outcome: "declined",
        attempts: 1,
      }),
    ).resolves.toBe(true);

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.to).toEqual([{ email: "care@someonenear.com" }]);
    expect(body.textContent).toContain("The invitee declined");
    expect(body.textContent).toContain("+919876543210");
  });
});
