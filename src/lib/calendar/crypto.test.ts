import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, signState, verifyState } from "./crypto.server";

const KEY = "test-key-please-change-32bytes-long!!";

describe("encryptSecret/decryptSecret", () => {
  it("round-trips a secret", async () => {
    const enc = await encryptSecret("refresh-token-123", KEY);
    expect(enc).not.toContain("refresh-token-123");
    expect(await decryptSecret(enc, KEY)).toBe("refresh-token-123");
  });

  it("fails to decrypt with the wrong key", async () => {
    const enc = await encryptSecret("secret", KEY);
    await expect(decryptSecret(enc, "different-key-different-key-32b!!")).rejects.toBeTruthy();
  });
});

describe("signState/verifyState", () => {
  it("round-trips a payload", async () => {
    const token = await signState({ userId: "u1" }, KEY, 60_000);
    const out = await verifyState(token, KEY);
    expect(out?.userId).toBe("u1");
  });

  it("rejects a tampered token", async () => {
    const token = await signState({ userId: "u1" }, KEY, 60_000);
    expect(await verifyState(token + "x", KEY)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signState({ userId: "u1" }, KEY, -1);
    expect(await verifyState(token, KEY)).toBeNull();
  });
});
