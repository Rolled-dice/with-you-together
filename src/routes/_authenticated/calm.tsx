import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CalmSanctuary } from "@/components/prototype/calm-sanctuary";
export const Route = createFileRoute("/_authenticated/calm")({
  head: () => ({ meta: [{ title: "Calm | SomeoneNear" }] }),
  component: () => (
    <AppShell>
      <CalmSanctuary />
    </AppShell>
  ),
});
