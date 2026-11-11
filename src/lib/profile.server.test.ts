import { describe, expect, it } from "vitest";
import { phoneChangePatch } from "./profile.server";

describe("profile phone updates", () => {
  it("does not clear verification for a formatting-only change", () => {
    expect(phoneChangePatch("+91 78381 59988", "+917838159988")).toEqual({});
  });

  it("clears verification when the number changes", () => {
    expect(phoneChangePatch("+917838159988", "+918920675867")).toEqual({
      phone: "+918920675867",
      phone_verified: false,
    });
  });

  it("does not touch the number when the settings form omits it", () => {
    expect(phoneChangePatch("+917838159988", undefined)).toEqual({});
  });
});
