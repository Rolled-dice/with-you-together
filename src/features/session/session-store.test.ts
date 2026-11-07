import { expect, it } from "vitest";
import { assertIdentity, getIdentity, setIdentity } from "./session-store";
it("rejects previous-account completions while allowing same-user token refresh", () => {
  setIdentity("account-a");
  const initial = getIdentity().generation;
  setIdentity("account-a");
  expect(getIdentity().generation).toBe(initial);
  expect(() => assertIdentity(initial)).not.toThrow();
  setIdentity("account-b");
  expect(() => assertIdentity(initial)).toThrow(/Session changed/);
  const next = getIdentity().generation;
  setIdentity(null);
  expect(() => assertIdentity(next)).toThrow();
});
