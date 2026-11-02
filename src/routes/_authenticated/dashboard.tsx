import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/app-shell";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { NotificationPermissionStatus } from "@/features/notifications/permission-status";
import { assertIdentity, useIdentity } from "@/features/session/session-store";
import { getMyProfile } from "@/lib/profile.functions";
import { getMyFamily } from "@/lib/family.functions";
import { listReminders } from "@/lib/reminders.functions";
import { ChatCircleIcon, CalendarHeartIcon, UsersIcon, ChartLineIcon } from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Your space | SomeoneNear" }] }),
  component: Dashboard,
});
const profileSchema = z.object({ display_name: z.string().nullable() });
const familySchema = z.object({
  members: z.array(
    z.object({ id: z.string(), display_name: z.string().nullable(), role: z.string() }),
  ),
});
const remindersSchema = z.array(
  z.object({ id: z.string(), title: z.string(), due_at: z.string() }),
);
const destinations = [
  {
    to: "/companion",
    title: "A little space to talk",
    description: "Your private AI Companion, at your pace.",
    icon: ChatCircleIcon,
  },
  {
    to: "/family",
    title: "Your family circle",
    description: "Keep your people close, with sharing you control.",
    icon: UsersIcon,
  },
  {
    to: "/send-later",
    title: "Something to look forward to",
    description: "Schedule a message for someone you love.",
    icon: CalendarHeartIcon,
  },
  {
    to: "/insights",
    title: "A moment to reflect",
    description: "Notice your feelings and the patterns over time.",
    icon: ChartLineIcon,
  },
] as const;
function Dashboard() {
  const identity = useIdentity();
  const profileFn = useServerFn(getMyProfile);
  const familyFn = useServerFn(getMyFamily);
  const remindersFn = useServerFn(listReminders);
  const query = useQuery({
    queryKey: ["dashboard", identity.userId],
    enabled: !!identity.userId,
    retry: 1,
    queryFn: async () => {
      const [profile, family, reminders] = await Promise.all([
        profileFn(),
        familyFn(),
        remindersFn(),
      ]);
      assertIdentity(identity.generation);
      return {
        profile: profileSchema.parse(profile),
        family: familySchema.parse(family),
        reminders: remindersSchema.parse(reminders),
      };
    },
  });
  return (
    <AppShell>
      <PageHeader
        eyebrow="Your space"
        title={
          query.data?.profile.display_name
            ? `Welcome, ${query.data.profile.display_name}`
            : "A little closer, every day."
        }
        description="Make room for the people and moments that matter."
      />
      <NotificationPermissionStatus />
      {query.isPending ? (
        <DataSkeleton />
      ) : query.isError ? (
        <DataError retry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-serif text-2xl font-bold">Your circle</h2>
            {query.data.family.members.length ? (
              <ul className="mt-4 space-y-3">
                {query.data.family.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex justify-between gap-3 border-b border-border py-3"
                  >
                    <span>{member.display_name || "Family member"}</span>
                    <span className="text-sm text-muted-foreground">{member.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="my-4 text-muted-foreground">
                Your circle is ready when you are. Invite the people you want to share it with.
              </p>
            )}
            <Link
              to="/family"
              className="mt-4 inline-flex min-h-11 items-center font-semibold underline"
            >
              Open family circle
            </Link>
          </section>
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-serif text-2xl font-bold">Things to remember</h2>
            {query.data.reminders.length ? (
              <ul className="mt-4 space-y-3">
                {query.data.reminders.slice(0, 4).map((item) => (
                  <li key={item.id} className="border-b border-border py-3">
                    {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="my-4 text-muted-foreground">
                No pending reminders. Add one whenever you need a little help remembering.
              </p>
            )}
            <Link
              to="/reminders"
              className="mt-4 inline-flex min-h-11 items-center font-semibold underline"
            >
              Manage reminders
            </Link>
          </section>
        </div>
      )}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {destinations.map(({ to, title, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="rounded-3xl border border-border bg-card p-6 transition-colors hover:bg-surface"
          >
            <Icon className="mb-4 h-7 w-7 text-brand-accent" aria-hidden="true" />
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
