// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncableCalendarEvent } from "./types";
const mocks = vi.hoisted(() => ({
  pending: [] as SyncableCalendarEvent[],
  missingEmail: false,
  guardians: false,
  sourceError: "",
  send: vi.fn(),
  bundle: vi.fn(),
  mark: vi.fn(),
  pendingLookup: vi.fn(),
  schedule: vi.fn(),
  constructor: vi.fn(),
  filters: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: mocks.missingEmail ? "" : "member@example.test" } },
          error: null,
        }),
      },
    },
    from: (table: string) => {
      const result = () => ({
        data:
          table === "profiles"
            ? { display_name: "Member", timezone: "UTC" }
            : table === "family_members"
              ? mocks.guardians
                ? { family_id: "family" }
                : null
              : [],
        error: mocks.sourceError === table ? new Error("source unavailable") : null,
      });
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          mocks.filters(table, column, value);
          return query;
        },
        gte: () => query,
        lte: () => query,
        in: () => query,
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => void) =>
          resolve(
            table === "family_members"
              ? { data: [{ user_id: "guardian", role: "adult" }], error: null }
              : result(),
          ),
      };
      return query;
    },
  },
}));
vi.mock("./calendarSyncService", () => ({
  CalendarSyncService: class {
    constructor(...args: unknown[]) {
      mocks.constructor(...args);
    }
    scheduleItem = mocks.schedule;
    shutdown = async () => {};
  },
  SupabaseCalendarSyncRepository: class {
    findUndispatchedByUserId = mocks.pendingLookup;
    markDispatched = mocks.mark;
    findBySource = async () => null;
  },
}));
vi.mock("./mailDispatcher", () => ({
  createMailDispatcher: () => ({
    sendCalendarEvent: mocks.send,
    sendBundledCalendarEvents: mocks.bundle,
  }),
}));
import { runCalendarSyncWindow, triggerCalendarSyncForUser } from "./supabaseSyncEngine.server";
const event: SyncableCalendarEvent = {
  id: "event",
  userId: "member",
  itemType: "CHECKIN",
  externalUid: "event@example.test",
  sequence: 1,
  dispatchedSequence: null,
  title: "Check in",
  description: "",
  location: "",
  startTime: new Date(),
  endTime: new Date(),
  timezone: "UTC",
  rrule: null,
  alarmMinutesBefore: 15,
  status: "CONFIRMED",
  createdAt: new Date(),
  updatedAt: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.missingEmail = false;
  mocks.guardians = false;
  mocks.sourceError = "";
  mocks.pending = [event];
  mocks.pendingLookup.mockImplementation(async () => mocks.pending);
  mocks.send.mockResolvedValue({ success: true });
  mocks.bundle.mockResolvedValue({ success: true });
  mocks.mark.mockResolvedValue(event);
});
describe("Calendar synchronization failures", () => {
  it.each(["rejection", "provider-failure", "missing-email", "repository"])(
    "reports %s instead of a successful sync",
    async (failure) => {
      if (failure === "rejection") mocks.send.mockRejectedValue(new Error("SMTP unavailable"));
      if (failure === "provider-failure") mocks.send.mockResolvedValue({ success: false });
      if (failure === "missing-email") mocks.missingEmail = true;
      if (failure === "repository")
        mocks.pendingLookup.mockRejectedValue(new Error("repository failed"));
      const result = await triggerCalendarSyncForUser("member");
      expect(result.ok).toBe(false);
      expect(result.message).not.toContain("SMTP");
      expect(mocks.mark).not.toHaveBeenCalled();
    },
  );
  it("reports source query errors and limits the sweep to the requested member", async () => {
    mocks.sourceError = "dose_logs";
    const result = await runCalendarSyncWindow({ userId: "member" });
    expect(result.failed).toBeGreaterThan(0);
    expect(mocks.filters).toHaveBeenCalledWith("dose_logs", "for_user_id", "member");
    expect(mocks.filters).toHaveBeenCalledWith("reminders", "for_user_id", "member");
    expect(mocks.filters).toHaveBeenCalledWith("listener_bookings", "user_id", "member");
    expect(mocks.constructor.mock.calls[0][2]).toBe(true);
  });
  it("leaves invitations pending if a guardian delivery fails", async () => {
    mocks.guardians = true;
    mocks.send.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    const result = await triggerCalendarSyncForUser("member");
    expect(result.ok).toBe(false);
    expect(mocks.mark).not.toHaveBeenCalled();
  });
  it("reports a tracking failure rather than claiming success", async () => {
    mocks.mark.mockRejectedValue(new Error("database failed"));
    const result = await triggerCalendarSyncForUser("member");
    expect(result.ok).toBe(false);
  });
  it("continues after one failure and reports partial success accurately", async () => {
    mocks.pending = [event, { ...event, id: "second" }];
    mocks.send
      .mockRejectedValueOnce(new Error("send failed"))
      .mockResolvedValueOnce({ success: true });
    const result = await runCalendarSyncWindow({ userId: "member" });
    expect(result).toMatchObject({ failed: 1, dispatched: 1 });
    expect(mocks.mark).toHaveBeenCalledExactlyOnceWith("second", event.sequence);
  });
  it("uses CANCEL for cancelled medication bundles", async () => {
    mocks.pending = [event, { ...event, id: "second" }].map((item) => ({
      ...item,
      itemType: "MEDICATION",
      status: "CANCELLED",
    }));
    expect((await triggerCalendarSyncForUser("member")).ok).toBe(true);
    expect(mocks.bundle.mock.calls[0][0].map((item: { action: string }) => item.action)).toEqual([
      "CANCEL",
      "CANCEL",
    ]);
  });
  it("reports no pending work without claiming insertion into an external calendar", async () => {
    mocks.pending = [];
    const result = await triggerCalendarSyncForUser("member");
    expect(result.ok).toBe(true);
    expect(result.message).toBe("No new calendar invitations to send.");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
