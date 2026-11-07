import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { timeZoneSchema } from "./time";
import { assertIdentity, useIdentity } from "@/features/session/session-store";
export function useTimeZone() {
  const { userId, generation } = useIdentity();
  const getProfile = useServerFn(getMyProfile);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return useQuery({
    queryKey: ["time-zone", userId],
    enabled: !!userId,
    initialData: timeZoneSchema.parse(browserTimeZone),
    retry: 1,
    queryFn: async () => {
      const profile = await getProfile();
      assertIdentity(generation);
      // Only invoked in a client-hydrated authenticated route.
      return timeZoneSchema.parse(
        profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
    },
  });
}
