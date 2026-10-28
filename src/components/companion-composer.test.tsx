import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceRecognition } from "@/hooks/use-companion-voice";
import { CompanionComposer } from "./companion-composer";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn() } } }));

class FakeRecognition implements VoiceRecognition {
  static current: FakeRecognition;
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: VoiceRecognition["onstart"] = null;
  onresult: VoiceRecognition["onresult"] = null;
  onerror: VoiceRecognition["onerror"] = null;
  onend: VoiceRecognition["onend"] = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.current = this;
  }
  say(text: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
  }
}
function setup(disabled = false) {
  const onSend = vi.fn();
  const view = render(<CompanionComposer status="ready" disabled={disabled} onSend={onSend} />);
  return { ...view, onSend, input: screen.getByRole("textbox", { name: "Message to Companion" }) };
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Companion voice and text composer", () => {
  it("keeps the send icon and sending usable after a failed chat request", async () => {
    const { rerender, input, onSend } = setup();
    const icon = screen
      .getByRole("button", { name: "Send message" })
      .querySelector("svg")?.innerHTML;
    rerender(<CompanionComposer status="error" disabled={false} onSend={onSend} />);
    expect(
      screen.getByRole("button", { name: "Send message" }).querySelector("svg")?.innerHTML,
    ).toBe(icon);
    fireEvent.change(input, { target: { value: "Another message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Another message"));
  });
  it("keeps ordinary typing and manual sending available", async () => {
    const { input, onSend } = setup();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Typed message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Typed message"));
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("gets consent, appends speech to typed text, and never automatically sends", async () => {
    const { input, onSend } = setup();
    fireEvent.change(input, { target: { value: "Today" } });
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(input).toHaveValue("Today");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Stop listening" })).toBeInTheDocument();
    act(() => FakeRecognition.current.say("I feel happy"));
    expect(input).toHaveValue("Today I feel happy");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
    fireEvent.change(input, { target: { value: "Today I feel better" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Today I feel better"));
  });

  it("keeps edits made while listening and supports another dictation session", () => {
    sessionStorage.setItem("someonenear:voice-consent:v1", "yes");
    const { input } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    fireEvent.change(input, { target: { value: "My own words" } });
    act(() => FakeRecognition.current.say("and spoken words"));
    expect(input).toHaveValue("My own words and spoken words");
    fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    act(() => FakeRecognition.current.say("another thought"));
    expect(input).toHaveValue("My own words and spoken words another thought");
  });

  it("preserves a saved voice language without showing a language selector", () => {
    sessionStorage.setItem("someonenear:voice-consent:v1", "yes");
    localStorage.setItem("someonenear:voice-language", "hi-IN");
    setup();
    expect(screen.queryByRole("combobox", { name: "Voice language" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(FakeRecognition.current.lang).toBe("hi-IN");
  });

  it("uses the browser language automatically when no preference is saved", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-IN");
    sessionStorage.setItem("someonenear:voice-consent:v1", "yes");
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(FakeRecognition.current.lang).toBe("en-IN");
  });

  it("allows typing when voice is unavailable, and blocks input while chat is busy", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    vi.stubGlobal("MediaRecorder", undefined);
    const { input, rerender } = setup();
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeDisabled();
    expect(input).not.toBeDisabled();
    rerender(<CompanionComposer status="submitted" disabled onSend={vi.fn()} />);
    expect(input).toBeDisabled();
  });
});
