import { describe, expect, it } from "vitest";
import {
  createGlobeProjection,
  memberPoint,
  projectedCoreRadius,
  sampleMembers,
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
});
