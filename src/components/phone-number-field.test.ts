import { describe, expect, it } from "vitest";
import { phoneToE164 } from "./phone-number-field";

describe("phoneToE164", () => {
  it("combines selected country code with national number", () => {
    expect(phoneToE164("89206 75867", "IN")).toBe("+918920675867");
    expect(phoneToE164("202-555-0123", "US")).toBe("+12025550123");
  });

  it("keeps empty number empty", () => {
    expect(phoneToE164("", "GB")).toBe("");
  });
});
