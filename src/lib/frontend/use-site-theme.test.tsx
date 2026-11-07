import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSiteTheme } from "./use-site-theme";
let dark = false;
let change: (() => void) | undefined;
function Preview({ label }: { label: string }) {
  const [theme, choose] = useSiteTheme();
  return (
    <div>
      <output aria-label={label}>{theme}</output>
      <button onClick={() => choose("navy")}>Navy {label}</button>
      <button onClick={() => choose("cream")}>Cream {label}</button>
    </div>
  );
}
beforeEach(() => {
  localStorage.clear();
  dark = false;
  change = undefined;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_event: string, listener: () => void) => {
      change = listener;
    },
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("site theme", () => {
  it("follows the device theme until an explicit choice is saved", () => {
    dark = true;
    render(<Preview label="footer" />);
    expect(screen.getByLabelText("footer")).toHaveTextContent("navy");
    act(() => {
      dark = false;
      change?.();
    });
    expect(screen.getByLabelText("footer")).toHaveTextContent("cream");
    fireEvent.click(screen.getByRole("button", { name: "Navy footer" }));
    act(() => change?.());
    expect(screen.getByLabelText("footer")).toHaveTextContent("navy");
    expect(localStorage.getItem("sn_member_theme")).toBe("navy");
  });
  it("shares an explicit light choice across mounted surfaces and reloads", () => {
    dark = true;
    localStorage.setItem("sn_member_theme", "navy");
    render(
      <>
        <Preview label="navigation" />
        <Preview label="footer" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cream navigation" }));
    expect(screen.getByLabelText("footer")).toHaveTextContent("cream");
    cleanup();
    render(<Preview label="reloaded footer" />);
    expect(screen.getByLabelText("reloaded footer")).toHaveTextContent("cream");
  });
});
