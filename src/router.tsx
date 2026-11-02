import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
  const sensitiveQueryKeys = [
    ["me"],
    ["conversations"],
    ["messages"],
    ["memories"],
    ["family"],
    ["family-pool"],
    ["medications"],
    ["mood-checkins"],
    ["listener-bookings"],
    ["notifications"],
    ["reminders"],
    ["send-later"],
    ["send-later-contacts"],
    ["send-later-received"],
    ["session-feedback-prompt"],
  ];

  for (const queryKey of sensitiveQueryKeys) {
    queryClient.setQueryDefaults(queryKey, {
      staleTime: 0,
      gcTime: 0,
    });
  }

  return router;
};
