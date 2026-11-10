import { describe, expect, it } from "vitest";
import {
  createGlobeProjection,
  memberPoint,
  projectedCoreRadius,
  sampleMembers,
  createPreviewGlobeMembers,
  createGlobeMembersFromFamily,
} from "./globe-model";

describe("supplied ThreeJsFamilyStage projection", () => {
  it("matches the source camera's field of view, distance and zoom", () => {
    const camera = createGlobeProjection();
    for (const zoom of [0.75, 1, 1.35]) {
      camera.update(540, 395, zoom, 0, 0);
      const point = camera.project({ x: 1.23, y: 0, z: 0 });
      expect(point.x).toBeCloseTo(
        270 + ((395 / (2 * Math.tan((42 * Math.PI) / 360))) * 1.23 * zoom) / 4.3,
      );
      expect(point.y).toBeCloseTo(197.5);
    }
  });
  it("preserves the changing inner core independently of the outer dot shell", () => {
    const camera = createGlobeProjection();
    camera.update(540, 395, 1, 0, 0.12);
    const front = projectedCoreRadius(camera.project({ x: 1.23, y: 0, z: 0 }), 540, 395);
    camera.update(540, 395, 1, 1.4, 0.12);
    const side = projectedCoreRadius(camera.project({ x: 1.23, y: 0, z: 0 }), 540, 395);
    expect(front).toBeGreaterThan(side + 40);
    expect(side).toBe(85);
    expect(projectedCoreRadius({ x: 270, y: 197.5 }, 540, 395)).toBe(130);
  });
  it("brings each original member to the front using its source coordinates", () => {
    const camera = createGlobeProjection();
    for (const member of sampleMembers) {
      camera.update(540, 395, 1, -member.theta, 0.12);
      const point = camera.project(memberPoint(member));
      expect(point.x).toBeCloseTo(270);
      expect(point.visible).toBe(true);
    }
    camera.update(540, 395, 1, 0, 0);
    expect(camera.project({ x: 0, y: 0, z: -1.28 }).visible).toBe(false);
  });
  it("generates preview globe members with user host pin and sample members without crashing", () => {
    const preview = createPreviewGlobeMembers({ display_name: "John Doe", timezone: "Asia/Kolkata" });
    expect(preview.length).toBeGreaterThan(1);
    expect(preview[0].name).toContain("John Doe");
    expect(preview[0].badge).toBe("✨ Ready to Connect");
  });
  it("maps real family circle members and invitations to globe pins", () => {
    const members = createGlobeMembersFromFamily({
      family: { id: "fam-1", name: "The Rivera Family", owner_id: "user-1" },
      members: [
        { id: "mem-1", user_id: "user-1", role: "owner", display_name: "Carlos Rivera" },
        { id: "mem-2", user_id: "user-2", role: "member", display_name: "Elena Rivera" },
      ],
      invites: [
        { id: "inv-1", invitee_name: "Grandma Rosa", role: "adult", status: "pending", verification_status: "awaiting_call", token: "tok-123" },
      ],
      currentUserId: "user-1",
      userProfile: { display_name: "Carlos Rivera", timezone: "America/New_York" },
    });
    expect(members).toHaveLength(3);
    expect(members[0].name).toBe("Carlos Rivera");
    expect(members[0].badge).toBe("👑 Host");
    expect(members[2].name).toBe("Grandma Rosa");
    expect(members[2].badge).toBe("📞 Call Pending");
  });
});
