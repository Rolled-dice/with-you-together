import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { CalmSpace } from "@/components/calm/calm-space";

export const Route = createFileRoute("/_authenticated/calm-space")({
  head: () => ({
    meta: [
      { title: "Calm | SomeoneNear" },
      {
        name: "description",
        content: "A quiet minute: guided breathing and a gentle game to let worries float away.",
      },
    ],
  }),
  component: CalmPage,
});

function CalmPage() {
  return (
    <AppShell>
      <PageHeader title="Take a slow minute" description="Nothing to finish here. Stay as long as you like." />
      <CalmSpace />
    </AppShell>
  );
}
