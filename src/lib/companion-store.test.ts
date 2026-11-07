import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("aws4fetch", () => ({
  AwsClient: class {
    fetch = mocked.fetch;
  },
}));
import { createCompanionStore } from "./companion-store.server";
const actor = "00000000-0000-4000-8000-000000000001";
const env = {
  aws_region: "us-east-1",
  aws_access_key_id: "access",
  aws_secret_access_key: "secret",
  bedrock_guardrail_id: "guard",
  bedrock_guardrail_version: "1",
  dynamodb_summary_table: "memory",
  dynamodb_safety_table: "safety",
};
beforeEach(() => vi.resetAllMocks());
describe("Companion DynamoDB and Guardrail boundaries", () => {
  it("uses subjectId without a sort key for summaries and reads consistently", async () => {
    mocked.fetch.mockResolvedValue(new Response("{}"));
    expect(await createCompanionStore(env).loadSummary(actor)).toBeNull();
    const req = JSON.parse(mocked.fetch.mock.calls[0][1].body);
    expect(req.Key).toEqual({ subjectId: { S: actor } });
    expect(req.ConsistentRead).toBe(true);
  });
  it("protects summary writes against stale overwrites and resurrection after clear", async () => {
    mocked.fetch.mockResolvedValue(new Response("{}"));
    await createCompanionStore(env).saveSummary(actor, "summary", {
      summary: "old",
      updatedAt: "2026-11-05T00:00:00Z",
    });
    expect(JSON.parse(mocked.fetch.mock.calls[0][1].body)).toMatchObject({
      ConditionExpression: "updatedAt = :previous",
      ExpressionAttributeValues: { ":previous": { S: "2026-11-05T00:00:00Z" } },
    });
  });
  it("clears content while preserving a marker against first-write resurrection", async () => {
    mocked.fetch.mockImplementation(() => Promise.resolve(new Response("{}")));
    const store = createCompanionStore(env);
    await store.clearSummary(actor);
    await store.saveSummary(actor, "stale", null);
    const cleared = JSON.parse(mocked.fetch.mock.calls[0][1].body);
    expect(cleared.Item.summary).toEqual({ S: "" });
    expect(JSON.parse(mocked.fetch.mock.calls[1][1].body).ConditionExpression).toBe(
      "attribute_not_exists(subjectId)",
    );
  });
  it("stores structured safety metadata without raw user or AI content", async () => {
    mocked.fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            action: "GUARDRAIL_INTERVENED",
            assessments: [{ contentPolicy: { secret: "never store this" } }],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("{}"));
    expect(await createCompanionStore(env).check(actor, "private content", "INPUT")).toBe(true);
    const audit = JSON.parse(mocked.fetch.mock.calls[1][1].body);
    expect(audit.Item.subjectId.S).toBe(actor);
    expect(audit.Item.eventId.S).toBeTruthy();
    expect(JSON.stringify(audit)).not.toMatch(/private content|never store this/);
  });
  it("does not interpret AWS failure as a safe reply", async () => {
    mocked.fetch.mockResolvedValue(
      new Response(JSON.stringify({ __type: "AccessDeniedException" }), { status: 403 }),
    );
    await expect(createCompanionStore(env).check(actor, "Hello", "INPUT")).rejects.toThrow(
      /unavailable/,
    );
  });
});
