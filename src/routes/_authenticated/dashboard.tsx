import { createFileRoute } from "@tanstack/react-router";
import { CareDashboard } from "@/components/prototype/care-dashboard";
export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | SomeoneNear" }] }),
  component: CareDashboard,
});
