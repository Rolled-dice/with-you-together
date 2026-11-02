import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionLifecycle } from "./session-boundary";
import { getIdentity, setIdentity } from "./session-store";
const mocked = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  navigate: vi.fn(),
  invalidate: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: mocked.navigate, invalidate: mocked.invalidate }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof mocked.callback) => {
        mocked.callback = callback;
        return { data: { subscription: { unsubscribe: mocked.unsubscribe } } };
      },
    },
  },
}));
beforeEach(() => {
  setIdentity(null);
  vi.clearAllMocks();
});
describe("session isolation", () => {
  it("immediately clears A’s data when an auth event switches to B", () => {
    setIdentity("A");
    const client = new QueryClient();
    client.setQueryData(["family", "A"], { private: true });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <SessionLifecycle />
      </QueryClientProvider>,
    );
    act(() => mocked.callback?.("SIGNED_IN", { user: { id: "B" } }));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(getIdentity().userId).toBe("B");
    unmount();
    expect(mocked.unsubscribe).toHaveBeenCalledOnce();
  });
  it("preserves data for a same-account token refresh, clears on sign-out", () => {
    setIdentity("A");
    const client = new QueryClient();
    client.setQueryData(["family", "A"], "private");
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <SessionLifecycle />
      </QueryClientProvider>,
    );
    act(() => mocked.callback?.("TOKEN_REFRESHED", { user: { id: "A" } }));
    expect(client.getQueryData(["family", "A"])).toBe("private");
    act(() => mocked.callback?.("SIGNED_OUT", null));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(getIdentity().userId).toBeNull();
    unmount();
  });
});
