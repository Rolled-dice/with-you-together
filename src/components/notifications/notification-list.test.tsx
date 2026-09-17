import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotificationList, type NotificationItem } from "./notification-list";

/**
 * Render tests for the presentational NotificationList. Asserts its real
 * contract: empty-state copy when there are no items, title/body rendered per
 * item, and the dismiss button reporting the correct item id upward.
 */
const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n1",
  title: "Call reminder",
  body: "Your listener call is in 30 minutes.",
  severity: "info",
  read_at: null,
  created_at: "2026-01-01T12:00:00.000Z",
  ...over,
});

describe("NotificationList", () => {
  it("renders the empty state when there are no items", () => {
    render(<NotificationList items={[]} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Nothing yet\./i)).toBeInTheDocument();
  });

  it("renders each item's title and body", () => {
    const items = [
      item({ id: "a", title: "First", body: "First body" }),
      item({ id: "b", title: "Second", body: "Second body" }),
    ];
    render(<NotificationList items={items} onDismiss={vi.fn()} />);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("First body")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Second body")).toBeInTheDocument();
  });

  it("calls onDismiss with the clicked item's id", () => {
    const onDismiss = vi.fn();
    const items = [
      item({ id: "keep", title: "Keep me" }),
      item({ id: "target", title: "Dismiss me" }),
    ];
    render(<NotificationList items={items} onDismiss={onDismiss} />);

    const dismissButtons = screen.getAllByLabelText("Dismiss");
    expect(dismissButtons).toHaveLength(2);

    fireEvent.click(dismissButtons[1]);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith("target");
  });
});
