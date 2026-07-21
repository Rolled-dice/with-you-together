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
    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;

    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    // Refresh before validation on cold loads when the cached access token is
    // near expiry. This avoids bouncing returning users to /auth prematurely.
    if (expiresAtMs && expiresAtMs - Date.now() < 120_000) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw redirect({
          to: "/auth",
          search: { reason: "session_expired", redirect: location.href },
        });
      }
      session = refreshed.session;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle();

    if (
      profile &&
      !profile.onboarding_completed &&
      location.pathname !== "/onboarding"
    ) {
      throw redirect({ to: "/onboarding" });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
