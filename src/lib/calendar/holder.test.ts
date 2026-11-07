import { describe, it, expect } from "vitest";
import { resolveHolder } from "./holder";

const cal = (user_id: string, calendar_id = "primary") => ({ user_id, calendar_id });

describe("resolveHolder", () => {
  it("prefers a connected family admin over the person themselves", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("member"), cal("admin", "fam@x.com")],
      familyAdults: [{ admin_user_id: "admin", member_user_id: "member" }],
    });
    expect(r).toEqual({ user_id: "admin", calendar_id: "fam@x.com" });
  });

  it("falls back to the person's own calendar when no admin is connected", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("member")],
      familyAdults: [{ admin_user_id: "admin", member_user_id: "member" }],
    });
    expect(r).toEqual({ user_id: "member", calendar_id: "primary" });
  });

  it("returns null when nobody relevant is connected", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("stranger")],
      familyAdults: [],
    });
    expect(r).toBeNull();
  });

  it("ignores admins who are not connected", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("member")],
      familyAdults: [{ admin_user_id: "admin", member_user_id: "member" }],
    });
    expect(r).toEqual({ user_id: "member", calendar_id: "primary" });
  });
});
