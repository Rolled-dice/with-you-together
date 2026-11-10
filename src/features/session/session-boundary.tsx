import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getIdentity, setIdentity, useIdentity } from "./session-store";
import { BootstrapLoader } from "@/components/feedback/load-state";

export function SessionLifecycle() {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Hydrate the identity explicitly. Some browsers can miss the initial
    // auth event when the listener is registered during route hydration.
    void supabase.auth.getSession().then(({ data }) => {
      if (!disposed) setIdentity(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      const previous = getIdentity();
      const userId = session?.user.id ?? null;
      const changed = previous.userId !== userId;
      // Clear synchronously before notifying subscribers; callbacks never await auth SDK work.
      if (changed || event === "SIGNED_OUT") {
        void queryClient.cancelQueries();
        queryClient.clear();
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.removeItem("sn_ice_card_v1");
            if (previous.userId) {
              localStorage.removeItem(`sn_ice_card_v1_${previous.userId}`);
              localStorage.removeItem(`sn_member_art_${previous.userId}`);
            }
          }
        } catch {
          /* ignore storage access restriction */
        }
      }
      setIdentity(userId);
      // The initial route is already loading. Invalidating it here races hydration.
      if (event === "INITIAL_SESSION") return;
      if (!changed && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (disposed) return;
        if (event === "SIGNED_OUT") {
          void router.navigate({ to: "/auth", replace: true });
        } else {
          void router.invalidate();
        }
      }, 0);
    });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, [router, queryClient]);
  return null;
}
export function PrivateSessionBoundary({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const identity = useIdentity();
  if (!identity.initialized || identity.userId !== userId)
    return <BootstrapLoader message="Checking your session…" />;
  return <div key={`${userId}:${identity.generation}`}>{children}</div>;
}
