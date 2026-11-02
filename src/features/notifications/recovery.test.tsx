import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { RealtimeRecovery } from "./use-notifications";
import { setIdentity } from "@/features/session/session-store";
const mocked = vi.hoisted(() => ({ channel: vi.fn(), remove: vi.fn(), session: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({ middleware: () => ({ handler: () => null }) }),
}));
vi.mock("@/lib/notifications.functions", () => ({ listMyNotifications: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocked.channel,
    removeChannel: mocked.remove,
    auth: { getSession: mocked.session },
  },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("coalesces repeated wake events without creating duplicate channels", async () => {
  vi.useFakeTimers();
  setIdentity("A");
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  mocked.channel.mockReturnValue(channel);
  mocked.session.mockResolvedValue({ data: { session: { user: { id: "A" } } }, error: null });
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <RealtimeRecovery userId="A" />
    </QueryClientProvider>,
  );
  await act(async () => {
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(mocked.channel).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledOnce();
  unmount();
  expect(mocked.remove).toHaveBeenCalledWith(channel);
});
