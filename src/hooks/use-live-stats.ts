import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicStats, type PublicStats } from "@/lib/stats.functions";

/**
 * Keeps the landing-page stats tiles live without a page reload.
 *
 * Public visitors are anonymous, so Realtime postgres_changes events are not
 * deliverable to them (the underlying tables have no anon SELECT policies).
 * Instead we re-poll the aggregate-only RPC on an interval, plus immediately
 * whenever the tab regains focus/visibility, which is effectively live for
 * numbers that move slowly.
 */
export function useLiveStats(initial: PublicStats, intervalMs = 20_000) {
  const fetchStats = useServerFn(getPublicStats);
  const [stats, setStats] = useState<PublicStats>(initial);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (inFlight.current || document.visibilityState === "hidden") return;
      inFlight.current = true;
      try {
        const next = await fetchStats();
        if (!cancelled && next) setStats(next);
      } catch {
        // transient network issue — keep showing the last known numbers
      } finally {
        inFlight.current = false;
      }
    };

    const timer = window.setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchStats, intervalMs]);

  return stats;
}
