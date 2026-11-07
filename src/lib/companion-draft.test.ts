import { describe, expect, it } from "vitest";
import { consumeCompanionDraft, prepareCompanionDraft } from "./companion-draft";
describe("private Companion draft handoff", () => {
  it("consumes only once on the matching thread", () => {
    prepareCompanionDraft({ userId: "one", generation: 1, threadId: "thread", text: "hello" });
    expect(consumeCompanionDraft("one", 1, "other")).toBeNull();
    expect(consumeCompanionDraft("one", 1, "thread")).toBe("hello");
    expect(consumeCompanionDraft("one", 1, "thread")).toBeNull();
  });
  it("discards drafts after a session changes", () => {
    prepareCompanionDraft({ userId: "one", generation: 1, threadId: "thread", text: "private" });
    expect(consumeCompanionDraft("one", 2, "thread")).toBeNull();
    expect(consumeCompanionDraft("one", 1, "thread")).toBeNull();
  });
});
