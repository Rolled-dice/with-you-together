import { CaretDownIcon, EyeIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import {
  VIEW_AS_LABEL,
  getViewAsRole,
  setViewAsRole,
  type ViewAsRole,
} from "@/lib/dev-view-as";

const ROLES: ViewAsRole[] = ["member", "admin", "listener"];

/**
 * Floating "view as" control, dev builds only.
 *
 * Renders in AppShell so it's present on every authenticated page. Reads and
 * writes only the local override in dev-view-as.ts — see that file for why
 * this cannot grant access beyond what the signed-in account already has.
 */
export function DevViewAsSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ViewAsRole | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Read after mount only: avoids an SSR/client text mismatch, since the
  // override lives in localStorage and doesn't exist on the server at all.
  useEffect(() => {
    setActive(getViewAsRole());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!import.meta.env.DEV) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-4 left-4 z-[999] font-sans"
      // Keeps this out of the AppShell's own layout flow entirely.
      style={{ position: "fixed" }}
    >
      {open && (
        <div className="mb-2 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-soft">
          <div className="border-b border-border px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              View as (dev only)
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Changes the sidebar and nav only. Pages that check the role
              themselves (Call CRM, Agent console) still use your real
              account and are unaffected.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewAsRole(null)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
          >
            Real role
            {active === null && <CheckDot />}
          </button>
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setViewAsRole(role)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {VIEW_AS_LABEL[role]}
              {active === role && <CheckDot />}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft"
        title="Preview the app as admin, listener or member — dev only, no database writes"
      >
        <EyeIcon className="h-3.5 w-3.5" />
        {active ? `Viewing as ${VIEW_AS_LABEL[active]}` : "View as…"}
        <CaretDownIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

function CheckDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-primary" />;
}
