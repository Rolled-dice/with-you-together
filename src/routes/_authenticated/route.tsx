import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

import { BootstrapLoader, DataError } from "@/components/feedback/load-state";
import { PrivateSessionBoundary } from "@/features/session/session-boundary";
import { RealtimeRecovery } from "@/features/notifications/use-notifications";
import { safeAuthRedirect } from "@/lib/auth-routing";
import { capabilities } from "@/lib/frontend/capabilities";

function AuthGateLoader() {
  return <BootstrapLoader message="Checking your session…" />;
}
function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <PrivateSessionBoundary userId={user.id}>
      <RealtimeRecovery userId={user.id} />
      <Outlet />
    </PrivateSessionBoundary>
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
      throw redirect({ to: "/auth", search: { redirect: safeAuthRedirect(location.href) } });
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    const nowMs = Date.now();

    // Hard-expired: must refresh synchronously before rendering.
    if (expiresAtMs && expiresAtMs <= nowMs) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        await supabase.auth.signOut({ scope: "local" });
        throw redirect({
          to: "/auth",
          search: { reason: "session_expired", redirect: safeAuthRedirect(location.href) },
        });
      }
      session = refreshed.session;
    }

    // Near-expiry: kick off a background refresh so the token stays fresh
    // without blocking the initial render. onAuthStateChange handles the update.
    if (expiresAtMs && expiresAtMs - nowMs < 120_000) {
      void supabase.auth.refreshSession();
    }

    const { data: verified, error: verificationError } = await supabase.auth.getUser();
    if (verificationError || verified.user?.id !== session.user.id) {
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth", search: { redirect: safeAuthRedirect(location.href) } });
    }
    const [{ data: isAdmin, error: adminError }, { data: isAgent, error: agentError }] =
      await Promise.all([
        supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }),
        supabase.rpc("is_call_agent", { _uid: session.user.id }),
      ]);

    // A role-helper outage must not strand ordinary signed-in members on the
    // bootstrap screen. Treat failed checks as false so staff routes remain
    // protected while the member app can still render its own error states.
    if (adminError || agentError) {
      console.error("Unable to verify account permissions", { adminError, agentError });
    }
    const admin = adminError ? false : Boolean(isAdmin);
    const agent = agentError ? false : Boolean(isAgent);
    const current = (await supabase.auth.getSession()).data.session;
    if (current?.user.id !== session.user.id) throw redirect({ to: "/auth" });
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (
      !capabilities.purchase &&
      import.meta.env.VITE_DODO_MODE !== "test" &&
      path === "/checkout"
    ) {
      throw redirect({ to: "/dashboard" });
    }
    // const isAdminPage = path === "/admin/calls";
    const isAdminPage = path.startsWith("/admin/");

    const isAgentPage = path === "/agent/console";
    const isStaffPage = path.startsWith("/admin/") || path.startsWith("/agent/");

    if (admin && !isAdminPage) {
      throw redirect({ to: "/admin/calls" });
    }

    if (!admin && agent && !isAgentPage) {
      throw redirect({ to: "/agent/console" });
    }

    if (!admin && !agent && isStaffPage) {
      throw redirect({ to: "/dashboard" });
    }

    return { user: session.user, isAdmin: admin, isAgent: agent };
  },

  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  errorComponent: ({ reset }) => <DataError retry={reset} />,
  component: AuthenticatedLayout,
});
