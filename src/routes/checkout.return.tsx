import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Thank you — WithU" }] }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-brand border border-border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          {session_id ? "Welcome to your new Care Membership" : "Checkout complete"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your membership will update in a moment. You can manage or cancel anytime from Settings.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-brand">
            <Link to="/settings">Manage membership</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
