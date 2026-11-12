import { describe, expect, it } from "vitest";
import { phoneToE164, splitPhone } from "./phone-number-field";

describe("phoneToE164", () => {
  it("combines selected country code with national number", () => {
    expect(phoneToE164("89206 75867", "IN")).toBe("+918920675867");
    expect(phoneToE164("202-555-0123", "US")).toBe("+12025550123");
  });

  it("keeps empty number empty", () => {
    expect(phoneToE164("", "GB")).toBe("");
  });
});

describe("splitPhone", () => {
  it("clears national number when value is dial code only or empty", () => {
    expect(splitPhone("", "IN")).toEqual({ country: "IN", national: "" });
    expect(splitPhone("+91", "IN")).toEqual({ country: "IN", national: "" });
    expect(splitPhone("+1", "US")).toEqual({ country: "US", national: "" });
  });

  it("extracts single typed digit without duplicating calling code", () => {
    expect(splitPhone("+919", "IN")).toEqual({ country: "IN", national: "9" });
    expect(splitPhone("+9198", "IN")).toEqual({ country: "IN", national: "98" });
  });

  it("extracts full national number cleanly", () => {
    expect(splitPhone("+919876543210", "IN")).toEqual({ country: "IN", national: "9876543210" });
    expect(splitPhone("9876543210", "IN")).toEqual({ country: "IN", national: "9876543210" });
    expect(splitPhone("+12025550123", "IN")).toEqual({ country: "US", national: "2025550123" });
  });
});
