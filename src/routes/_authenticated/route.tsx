import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function AuthGateLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <p className="text-sm">Checking your session…</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: AuthGateLoader,
  pendingMs: 0,
  wrapInSuspense: true,
  beforeLoad: async ({ location }) => {
    let session = (await supabase.auth.getSession()).data.session;

    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    const nowMs = Date.now();

    // Hard-expired: must refresh synchronously before rendering.
    if (expiresAtMs && expiresAtMs <= nowMs) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw redirect({
          to: "/auth",
          search: { reason: "session_expired", redirect: location.href },
        });
      }
      session = refreshed.session;
    }

    // Near-expiry: kick off a background refresh so the token stays fresh
    // without blocking the initial render. onAuthStateChange handles the update.
    if (expiresAtMs && expiresAtMs - nowMs < 120_000) {
      void supabase.auth.refreshSession();
    }

    const [{ data: isAdmin }, { data: isAgent }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }),
      supabase.rpc("is_call_agent", { _uid: session.user.id }),
    ]);

    const path = location.pathname;
    // const isAdminPage = path === "/admin/calls";
    const isAdminPage = path.startsWith("/admin/");

    const isAgentPage = path === "/agent/console";
    const isStaffPage = path.startsWith("/admin/") || path.startsWith("/agent/");

    if (isAdmin && !isAdminPage) {
      throw redirect({ to: "/admin/calls" });
    }

    if (!isAdmin && isAgent && !isAgentPage) {
      throw redirect({ to: "/agent/console" });
    }

    if (!isAdmin && !isAgent && isStaffPage) {
      throw redirect({ to: "/dashboard" });
    }

    return { user: session.user, isAdmin: Boolean(isAdmin), isAgent: Boolean(isAgent) };
  },

  component: () => <Outlet />,
});
