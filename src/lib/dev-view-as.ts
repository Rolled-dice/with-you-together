/**
 * Dev-only role preview ("view as").
 *
 * Lets you preview the admin, listener (agent) and member nav/shell states in
 * a single browser session without writing anything to `user_roles` or
 * `call_agents`. Real role gating is untouched: `_authenticated/route.tsx`'s
 * `beforeLoad` and every server function still call the real `has_role` /
 * `is_call_agent` RPCs against the actual Supabase project on every
 * navigation and every request. This override only changes what `AppShell`
 * chooses to *render* for the account you are already signed into — nothing
 * it does can grant access to a page or a row that your real account
 * couldn't already reach.
 *
 * Fully stripped from production:
 *   - `import.meta.env.DEV` is a Vite build-time constant. In a production
 *     build every branch below is dead code and gets removed, not just
 *     hidden — there is no runtime flag an end user could flip.
 *   - Storage is scoped to this one browser tab's localStorage, so it can
 *     never affect another visitor, another device, or the server.
 */

export type ViewAsRole = "admin" | "listener" | "member";

const STORAGE_KEY = "dev:view-as";

function readRaw(): string | null {
  if (!import.meta.env.DEV) return null;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can throw in locked-down contexts (private browsing, etc).
    // Falling back to "no override" is the safe direction.
    return null;
  }
}

export function getViewAsRole(): ViewAsRole | null {
  const raw = readRaw();
  return raw === "admin" || raw === "listener" || raw === "member" ? raw : null;
}

export function setViewAsRole(role: ViewAsRole | null): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  try {
    if (role) window.localStorage.setItem(STORAGE_KEY, role);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort; nothing to recover from here.
  }
  // Not wired through React state on purpose: a full reload guarantees every
  // route loader and server-fn-backed query re-runs from a clean slate, which
  // matters because _authenticated/route.tsx redirects based on the REAL
  // role and this override never changes that redirect.
  window.location.reload();
}

/** Human labels for the switcher UI. */
export const VIEW_AS_LABEL: Record<ViewAsRole, string> = {
  admin: "Admin",
  listener: "Listener",
  member: "Member",
};
