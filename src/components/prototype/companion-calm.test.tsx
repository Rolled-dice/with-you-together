import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanionCalm } from "./companion-calm";
vi.mock("@/lib/interaction-feedback", () => ({ playSingingBowl: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("Companion calm space", () => {
  it("uses the actual 4/7/8 rhythm and pauses while hidden", () => {
    vi.useFakeTimers();
    const view = render(<CompanionCalm />);
    fireEvent.click(screen.getByRole("button", { name: /Sleepy/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start breathing" }));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole("status").textContent).toContain("Hold gently");
    expect(screen.getByRole("status").textContent).toContain("7s");
    view.rerender(<CompanionCalm visible={false} />);
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.getByRole("status").textContent).toContain("7s");
    view.rerender(<CompanionCalm visible />);
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("status").textContent).toContain("8s");
    fireEvent.click(screen.getByRole("button", { name: "Pause breathing" }));
    act(() => vi.advanceTimersByTime(9000));
    fireEvent.click(screen.getByRole("button", { name: "Start breathing" }));
    expect(screen.getByRole("status").textContent).toContain("8s");
  });
  it("releases and dissolves worries without persistence", () => {
    const store = vi.spyOn(Storage.prototype, "setItem");
    render(<CompanionCalm />);
    fireEvent.click(screen.getByRole("tab", { name: /Let it float/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A sample thought" } });
    fireEvent.click(screen.getByRole("button", { name: /Let It Float Away/ }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Dissolve worry: A sample thought" }));
    expect(screen.queryByText("“A sample thought”")).toBeNull();
    expect(store).not.toHaveBeenCalled();
    store.mockRestore();
  });
});
