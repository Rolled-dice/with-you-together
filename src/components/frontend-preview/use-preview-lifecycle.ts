import { useCallback, useEffect, useRef, type RefObject } from "react";

export function usePreviewTimeouts() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );
  return useCallback((callback: () => void, milliseconds: number) => {
    const timer = globalThis.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, milliseconds);
    timers.current.add(timer);
    return timer;
  }, []);
}

// The imported prototype uses plain overlays. Give each overlay a keyboard boundary.
export function usePreviewLifecycle(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let activeDialog: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;
    const focusables = (element: HTMLElement) =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select, textarea, [tabindex='0']",
        ),
      ).filter((item) => item.getClientRects().length > 0);
    const sync = () => {
      container.querySelectorAll<HTMLElement>(".fixed.inset-0").forEach((overlay) => {
        const panel = overlay.firstElementChild;
        if (!(panel instanceof HTMLElement)) return;
        panel.dataset.dialog = "true";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        const title = panel.querySelector("h3");
        panel.setAttribute("aria-label", title?.textContent?.trim() ?? "Preview options");
        panel.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
          if (!button.textContent?.trim() && !button.hasAttribute("aria-label"))
            button.setAttribute("aria-label", "Close dialog");
        });
      });
      const dialogs = container.querySelectorAll<HTMLElement>("[data-dialog]");
      const next = dialogs.item(dialogs.length - 1);
      if (next === activeDialog) return;
      if (next) {
        if (!activeDialog && document.activeElement instanceof HTMLElement)
          previousFocus = document.activeElement;
        activeDialog = next;
        focusables(next)[0]?.focus();
      } else {
        activeDialog = null;
        previousFocus?.focus();
        previousFocus = null;
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true });
    const onKey = (event: KeyboardEvent) => {
      if (!activeDialog) return;
      const items = focusables(activeDialog);
      if (event.key === "Escape") {
        activeDialog.querySelector<HTMLButtonElement>("button[aria-label='Close dialog']")?.click();
      }
      if (event.key !== "Tab" || !items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
    };
  }, [root]);
}
