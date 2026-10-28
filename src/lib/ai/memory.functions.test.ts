// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  userId: "member",
  middleware: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  deleteSummary: vi.fn(),
  deleteEvents: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: "required-auth",
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((value: unknown) => unknown) | undefined;
    let middleware: unknown[] = [];
    const builder = {
      middleware: (value: unknown[]) => {
        middleware = value;
        return builder;
      },
      validator: (value: (data: unknown) => unknown) => {
        validator = value;
        return builder;
      },
      handler:
        (handler: (input: { context: { userId: string }; data: unknown }) => unknown) =>
        async (input?: { data?: unknown }) => {
          mocks.middleware(middleware);
          if (!middleware.includes("required-auth") || !mocks.userId)
            throw new Error("Unauthorized");
          return handler({
            context: { userId: mocks.userId },
            data: validator ? validator(input?.data) : input?.data,
          });
        },
    };
    return builder;
  },
}));
vi.mock("./subject.server", () => ({
  resolveSubjectId: async (id: string) => `subject-for-${id}`,
}));
vi.mock("./factory.server", () => ({
  AiProviderFactory: {
    getUserSummaryStore: () => ({
      getSummary: mocks.get,
      saveSummary: mocks.save,
      deleteUserSummary: mocks.deleteSummary,
    }),
    getSafetyLogSink: () => ({ deleteUserEvents: mocks.deleteEvents }),
  },
}));
import {
  getMyCompanionSummary,
  updateMyCompanionSummary,
  clearMyCompanionSummary,
} from "./memory.functions";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId = "member";
  mocks.get.mockResolvedValue(null);
  mocks.save.mockResolvedValue(undefined);
  mocks.deleteSummary.mockResolvedValue(undefined);
  mocks.deleteEvents.mockResolvedValue(undefined);
});
describe("Authenticated memory controls", () => {
  it("rejects signed-out view/edit/clear before accessing storage", async () => {
    mocks.userId = "";
    await expect(getMyCompanionSummary()).rejects.toThrow("Unauthorized");
    await expect(
      updateMyCompanionSummary({ data: { summaryText: "Remember this" } }),
    ).rejects.toThrow("Unauthorized");
    await expect(clearMyCompanionSummary()).rejects.toThrow("Unauthorized");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.deleteSummary).not.toHaveBeenCalled();
    expect(mocks.deleteEvents).not.toHaveBeenCalled();
  });
  it("uses the middleware identity, never a client-supplied user ID", async () => {
    expect((await getMyCompanionSummary()).success).toBe(true);
    await updateMyCompanionSummary({ data: { summaryText: "I like short replies" } });
    expect(mocks.get).toHaveBeenCalledWith("subject-for-member");
    expect(mocks.save.mock.calls[0][0]).toMatchObject({
      subjectId: "subject-for-member",
      summaryText: "I like short replies",
    });
    await clearMyCompanionSummary();
    expect(mocks.deleteSummary).toHaveBeenCalledWith("subject-for-member");
    expect(mocks.deleteEvents).toHaveBeenCalledWith("subject-for-member");
    expect(mocks.middleware).toHaveBeenCalledWith(["required-auth"]);
  });
  it("validates updates and reports incomplete deletion honestly", async () => {
    await expect(
      updateMyCompanionSummary({ data: { summaryText: "x".repeat(1501) } }),
    ).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.deleteEvents.mockRejectedValue(new Error("Storage failed"));
    expect((await clearMyCompanionSummary()).success).toBe(false);
  });
});
