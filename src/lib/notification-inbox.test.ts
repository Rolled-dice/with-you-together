import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readNotificationInbox } from "./notification-inbox.server";
function client(results: unknown[]) {
  const queries: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const from = vi.fn(() => {
    const result = results[queries.length];
    const q: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "is", "not", "order", "limit"])
      q[method] = vi.fn(() => q);
    q.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
    queries.push(q);
    return q;
  });
  return { supabase: { from } as unknown as SupabaseClient, queries };
}
describe("notification inbox", () => {
  it("counts all eligible unread rows independently of the 30-row preview", async () => {
    const { supabase, queries } = client([
      { data: [], error: null },
      { count: 127, error: null },
    ]);
    const inbox = await readNotificationInbox(supabase, "owner");
    expect(inbox.unreadCount).toBe(127);
    expect(inbox.items).toEqual([]);
    for (const q of queries) {
      expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
      expect(q.is).toHaveBeenCalledWith("booking_id", null);
      expect(q.not).toHaveBeenCalledWith("kind", "ilike", "%call%");
    }
    expect(queries[0].limit).toHaveBeenCalledWith(30);
    expect(queries[1].is).toHaveBeenCalledWith("read_at", null);
  });
  it("does not turn failed count requests into a zero unread badge", async () => {
    const { supabase } = client([{ data: [], error: null }, { error: { message: "Unavailable" } }]);
    await expect(readNotificationInbox(supabase, "owner")).rejects.toThrow("Unavailable");
  });
});
