import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalmSanctuary } from "./calm-sanctuary";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function open() {
  render(<CalmSanctuary />);
  fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
}
describe("Calm activity interactions", () => {
  it("counts and resets spice pops without changing other activities", () => {
    open();
    fireEvent.click(screen.getAllByRole("button", { name: "🫧 Cardamom" })[0]);
    expect(screen.getByText(/1\/18 popped/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset Sheet" }));
    expect(screen.getByText(/0\/18 popped/)).toBeTruthy();
  });
  it("cancels an in-flight match when the deck is shuffled", () => {
    vi.useFakeTimers();
    open();
    fireEvent.click(screen.getByRole("tab", { name: /Keepsake Memory Match/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal card 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal card 7" }));
    fireEvent.click(screen.getByRole("button", { name: "Shuffle Deck" }));
    act(() => vi.runAllTimers());
    expect(screen.getAllByRole("button", { name: /Reveal card/ })).toHaveLength(12);
    expect(screen.getByText(/0\/6 matched/)).toBeTruthy();
  });
  it("keeps bowl and cat counters separate", () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: /Singing Bowl/ }));
    fireEvent.click(screen.getByRole("button", { name: /Strike Bowl/ }));
    expect(screen.getByText(/Struck 1 times/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Barnaby the Cat/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pet Barnaby/ }));
    expect(screen.getByText(/1 purrs this session/)).toBeTruthy();
  });
});
