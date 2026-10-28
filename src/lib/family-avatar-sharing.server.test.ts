// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: mocks.from },
}));
import { familySnapshot } from "./family.server";

const member = {
  id: "member",
  user_id: "parent",
  role: "adult",
  joined_at: "2026-10-01T00:00:00Z",
  display_name: "Dad",
  timezone: "Asia/Kolkata",
  receive_reminders: false,
  share_updates: false,
  share_health: false,
};
const snapshot = {
  viewer_id: "owner",
  family: null,
  myRole: null,
  canInvite: false,
  members: [member],
  invites: [],
  pending: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ in: mocks.in });
});

describe("family avatar sharing", () => {
  it("loads only verified snapshot members and shares only a built-in portrait", async () => {
    mocks.in.mockResolvedValue({
      data: [{ id: "parent", avatar_url: "/family-avatars.png#avatar-5" }],
      error: null,
    });
    const result = await familySnapshot("owner");
    expect(mocks.rpc).toHaveBeenCalledWith("family_command", {
      p_actor: "owner",
      p_action: "snapshot",
      p_data: {},
    });
    expect(mocks.select).toHaveBeenCalledWith("id, avatar_url");
    expect(mocks.in).toHaveBeenCalledWith("id", ["parent"]);
    expect(result.members[0].avatar_url).toBe("/family-avatars.png#avatar-5");
  });
  it("does not share an external profile photo", async () => {
    mocks.in.mockResolvedValue({
      data: [{ id: "parent", avatar_url: "https://private.example/photo.jpg" }],
      error: null,
    });
    expect((await familySnapshot("owner")).members[0].avatar_url).toBeNull();
  });
  it("does not query profiles when the snapshot contains no members", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...snapshot, members: [] }, error: null });
    await familySnapshot("owner");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("stops before querying profiles when family authorization fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "Access denied" } });
    await expect(familySnapshot("stranger")).rejects.toThrow("Access denied");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
