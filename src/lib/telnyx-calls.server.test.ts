import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  bridged: false,
  bookingUpdates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/telnyx.server", () => ({
  decodeClientState: () => ({ b: "booking-1", r: "member" }),
  telnyxConfig: () => null,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const query = {
        eq() { return query; },
        is() { return query; },
        in() { return query; },
        limit() { return Promise.resolve(result()); },
        then(resolve: (value: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      function result() {
        if (table === "call_events") {
          return { data: state.bridged ? [{ id: "bridge-1" }] : [], error: null };
        }
        return { data: [], error: null };
      }
      return {
        insert: () => Promise.resolve({ error: null }),
        update: (patch: Record<string, unknown>) => {
          if (table === "listener_bookings") state.bookingUpdates.push(patch);
          return query;
        },
        select: () => query,
      };
    },
  },
}));

import { handleTelnyxEvent } from "./telnyx-calls.server";

describe("listener call completion", () => {
  beforeEach(() => {
    state.bridged = false;
    state.bookingUpdates.length = 0;
  });

  const hangup = () => handleTelnyxEvent({
    data: { event_type: "call.hangup", payload: { call_control_id: "leg-1" } },
  });

  it("keeps an unconnected booking available for follow-up", async () => {
    await hangup();
    expect(state.bookingUpdates).toContainEqual(expect.objectContaining({
      status: "confirmed", crm_state: "escalated",
    }));
  });

  it("completes a booking after the member and listener were bridged", async () => {
    state.bridged = true;
    await hangup();
    expect(state.bookingUpdates).toContainEqual(expect.objectContaining({
      status: "completed", crm_state: "completed",
    }));
  });
});
