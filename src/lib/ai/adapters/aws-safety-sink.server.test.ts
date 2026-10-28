// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AwsSafetyLogSink } from "./aws-safety-sink.server";
vi.mock("../aws-sigv4.server", () => ({
  getAwsCredentials: () =>
    process.env.AWS_ACCESS_KEY_ID ? { accessKeyId: "test", secretAccessKey: "test" } : null,
  signAwsRequest: async (request: { headers: HeadersInit }) => request.headers,
}));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AWS_ACCESS_KEY_ID", "test");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("AWS audit deletion", () => {
  it("deletes every page before reporting completion", async () => {
    const cursor = { subjectId: { S: "subject" }, eventId: { S: "first" } };
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ Items: [{ eventId: { S: "first" } }], LastEvaluatedKey: cursor }),
      )
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ Items: [{ eventId: { S: "second" } }] }))
      .mockResolvedValueOnce(Response.json({}));
    await new AwsSafetyLogSink().deleteUserEvents("subject");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).ExclusiveStartKey).toEqual(cursor);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).Key.eventId.S).toBe("second");
  });
  it("propagates a failed deletion", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ Items: [{ eventId: { S: "first" } }] }))
      .mockResolvedValueOnce(new Response("Denied", { status: 403 }));
    await expect(new AwsSafetyLogSink().deleteUserEvents("subject")).rejects.toThrow();
  });
  it("fails closed when credentials are missing", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    await expect(new AwsSafetyLogSink().deleteUserEvents("subject")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
