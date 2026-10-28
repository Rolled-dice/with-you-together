// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: false,
  filters: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    from: () => {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          mocks.filters(column, value);
          return query;
        },
        order: () => query,
        update: (value: unknown) => {
          mocks.update(value);
          return query;
        },
        single: async () => ({
          data: mocks.rows[0],
          error: mocks.error ? new Error("version changed") : null,
        }),
        then: (resolve: (value: unknown) => void) => resolve({ data: mocks.rows, error: null }),
      };
      return query;
    },
  }),
}));
import { SupabaseCalendarSyncRepository } from "./calendarSyncService";
const row = {
  id: "event",
  user_id: "member",
  item_type: "CHECKIN",
  external_uid: "event@example.test",
  sequence: 2,
  dispatched_sequence: null,
  title: "Check in",
  description: "",
  location: "",
  start_time: "2026-10-02T12:00:00+00:00",
  end_time: "2026-10-02T12:30:00+00:00",
  timezone: "UTC",
  rrule: null,
  alarm_minutes_before: 15,
  status: "CONFIRMED",
  created_at: "2026-10-02T10:00:00+00:00",
  updated_at: "2026-10-02T10:00:00+00:00",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  mocks.error = false;
  mocks.rows = [row];
  mocks.rpc.mockResolvedValue({ data: row, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("Calendar repository dispatch tracking", () => {
  it("returns stale and cancelled pending versions, not already-dispatched events", async () => {
    mocks.rows = [
      row,
      { ...row, id: "stale", dispatched_sequence: 1 },
      { ...row, id: "sent", dispatched_sequence: 2 },
      { ...row, id: "cancelled", status: "CANCELLED", dispatched_sequence: 1 },
    ];
    const events = await new SupabaseCalendarSyncRepository().findUndispatchedByUserId("member");
    expect(events.map((event) => event.id)).toEqual(["event", "stale", "cancelled"]);
    expect(mocks.filters).toHaveBeenCalledWith("user_id", "member");
  });
  it("marks only the sequence that was delivered", async () => {
    await new SupabaseCalendarSyncRepository().markDispatched("event", 2);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ dispatched_sequence: 2 });
    expect(mocks.filters).toHaveBeenCalledWith("sequence", 2);
  });
  it("fails tracking if a concurrent edit changed the event version", async () => {
    mocks.error = true;
    await expect(new SupabaseCalendarSyncRepository().markDispatched("event", 2)).rejects.toThrow(
      "changed during delivery",
    );
  });
  it("sends a JSON object, not a JSON-encoded string, to the atomic RPC", async () => {
    await new SupabaseCalendarSyncRepository().atomicUpdateWithSequenceIncrement("event", {
      title: "Updated",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("atomic_calendar_event_update", {
      event_id: "event",
      payload: { title: "Updated" },
    });
  });
});
