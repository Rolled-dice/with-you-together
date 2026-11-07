import { describe, expect, it, vi } from "vitest";
import { deliverFamilyReminders } from "./family-reminder-delivery.server";

const job = {
  id: "11111111-1111-4111-8111-111111111111",
  lease_token: "22222222-2222-4222-8222-222222222222",
  endpoint: "https://push.example.test/device",
  p256dh: "p".repeat(65),
  auth: "a".repeat(22),
  url: "/reminders?view=everyday",
};

function fakeClient(claimed: unknown = []) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "prepare_reminder_delivery") return { data: 2, error: null };
    if (name === "claim_reminder_push") return { data: claimed, error: null };
    if (name === "finish_reminder_push") return { data: null, error: null };
    return { data: null, error: new Error("unexpected RPC") };
  });
  return { rpc } as any;
}

const configured = {
  FAMILY_PUSH_ENABLED: "true",
  WEB_PUSH_SUBJECT: "mailto:care@someonenear.com",
  WEB_PUSH_PUBLIC_KEY: "public-key",
  WEB_PUSH_PRIVATE_KEY: "private-key",
} as NodeJS.ProcessEnv;

describe("family reminder push delivery", () => {
  it("always prepares in-app reminder work while push is disabled", async () => {
    const client = fakeClient([job]);
    const sender = vi.fn();
    await expect(deliverFamilyReminders(client, {}, sender)).resolves.toEqual({
      prepared: 2,
      claimed: 0,
      sent: 0,
      retried: 0,
      expired: 0,
      pushEnabled: false,
    });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(sender).not.toHaveBeenCalled();
  });

  it("finishes a sent job with its database lease", async () => {
    const client = fakeClient([job]);
    const sender = vi.fn().mockResolvedValue("sent");
    const result = await deliverFamilyReminders(client, configured, sender);
    expect(result).toMatchObject({ prepared: 2, claimed: 1, sent: 1, pushEnabled: true });
    expect(sender).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: job.endpoint, authKey: job.auth }),
      { destination: job.url },
      configured,
    );
    expect(client.rpc).toHaveBeenLastCalledWith("finish_reminder_push", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_outcome: "sent",
    });
  });

  it("marks an expired endpoint as gone", async () => {
    const client = fakeClient([job]);
    const result = await deliverFamilyReminders(
      client,
      configured,
      vi.fn().mockResolvedValue("expired"),
    );
    expect(result).toMatchObject({ expired: 1, sent: 0 });
    expect(client.rpc).toHaveBeenLastCalledWith("finish_reminder_push", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_outcome: "gone",
    });
  });

  it("returns a temporary send failure to the database retry schedule", async () => {
    const client = fakeClient([job]);
    const result = await deliverFamilyReminders(
      client,
      configured,
      vi.fn().mockRejectedValue(new Error("offline")),
    );
    expect(result).toMatchObject({ retried: 1, sent: 0 });
    expect(client.rpc).toHaveBeenLastCalledWith("finish_reminder_push", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_outcome: "retry",
    });
  });
});
