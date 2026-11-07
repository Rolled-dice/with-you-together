import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationPermissionStatus } from "./permission-status";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each(["default", "granted", "denied"])(
  "shows actual %s permission without claiming delivery",
  (permission) => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("Notification", { permission });
    render(<NotificationPermissionStatus />);
    expect(screen.getByRole("status").textContent).toMatch(
      permission === "default" ? /hasn’t/ : permission === "denied" ? /blocked/ : /allowed/,
    );
    expect(screen.getByText(/Background push delivery is not available/)).toBeTruthy();
  },
);
it("refreshes revoked permission when returning to the page", () => {
  vi.stubGlobal("isSecureContext", true);
  const notification = { permission: "granted" };
  vi.stubGlobal("Notification", notification);
  render(<NotificationPermissionStatus />);
  notification.permission = "denied";
  act(() => window.dispatchEvent(new Event("focus")));
  expect(screen.getByRole("status").textContent).toMatch(/blocked/);
});
