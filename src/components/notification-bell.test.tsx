import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";
vi.mock("@phosphor-icons/react", () => ({ BellIcon: () => null, XIcon: () => null }));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>,
}));
const mocks = vi.hoisted(() => ({
  read: vi.fn().mockResolvedValue({ ok: true }),
  dismiss: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/notifications.functions", () => ({
  markNotificationsRead: mocks.read,
  dismissNotification: mocks.dismiss,
}));
vi.mock("@/features/notifications/use-notifications", () => ({
  notificationKey: (id: string) => ["notifications", id],
  useNotifications: mocks.query,
}));
vi.mock("@/features/session/session-store", () => ({ useIdentity: () => ({ userId: "owner" }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function open(data: unknown) {
  mocks.query.mockReturnValue({ data, isError: false, isPending: false });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationBell label="Family updates" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
}
describe("notification control", () => {
  it("keeps the exact count accessible and caps the visual badge", () => {
    open({ items: [], unreadCount: 127 });
    expect(screen.getByRole("button", { name: "Notifications, 127 unread" })).toHaveTextContent(
      "Family updates",
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark shown as read" })).toBeNull();
  });
  it("marks only the displayed unread IDs and leaves read rows alone", async () => {
    const item = {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Update",
      body: null,
      severity: "info",
      created_at: "2026-11-04T10:00:00Z",
      read_at: null,
    };
    open({
      items: [
        item,
        { ...item, id: "00000000-0000-4000-8000-000000000002", read_at: "2026-11-04T10:01:00Z" },
      ],
      unreadCount: 40,
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark shown as read" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.read).toHaveBeenCalledWith({ data: { ids: [item.id] } });
  });
});
