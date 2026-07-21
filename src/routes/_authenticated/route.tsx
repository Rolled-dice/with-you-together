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
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    if (
      profile &&
      !profile.onboarding_completed &&
      location.pathname !== "/onboarding"
    ) {
      throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
