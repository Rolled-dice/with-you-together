import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  removeWebPushSubscription,
  saveWebPushSubscription,
} from "./web-push-subscriptions.server";

const endpoint = "https://push.example.test/subscription/secret";
const input = { endpoint, keys: { p256dh: "p".repeat(65), auth: "a".repeat(22) } };

function fakeClient(existingUser: string | null = null) {
  const updateEq = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingUser ? { user_id: existingUser } : null,
    error: null,
  });
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ maybeSingle }),
  });
  const from = vi.fn().mockReturnValue({ select, update, insert, delete: del });
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    update,
    insert,
    del,
    maybeSingle,
  };
}

describe("server-managed web push subscriptions", () => {
  it("adds a subscription for the authenticated account", async () => {
    const db = fakeClient();
    await expect(saveWebPushSubscription(db.client, "user-1", input)).resolves.toEqual({
      ok: true,
    });
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        endpoint,
        enabled: true,
        auth_key: input.keys.auth,
      }),
    );
  });

  it("updates an existing endpoint only for its current owner", async () => {
    const db = fakeClient("user-1");
    await saveWebPushSubscription(db.client, "user-1", input);
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" }));
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("does not allow another account to claim an endpoint", async () => {
    const db = fakeClient("user-2");
    await expect(saveWebPushSubscription(db.client, "user-1", input)).rejects.toThrow(
      "already connected to a different account",
    );
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects insecure endpoints", async () => {
    const db = fakeClient();
    await expect(
      saveWebPushSubscription(db.client, "user-1", {
        ...input,
        endpoint: "http://push.example.test/endpoint",
      }),
    ).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("disables only the signed-in user's matching endpoint", async () => {
    const db = fakeClient();
    await removeWebPushSubscription(db.client, "user-1", endpoint);
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
});
