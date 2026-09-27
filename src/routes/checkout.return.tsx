import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { reconcileDodoSubscription } from "@/lib/dodo.functions";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string; subscription_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    subscription_id: typeof search.subscription_id === "string" ? search.subscription_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Thank you | SomeoneNear" }] }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id, subscription_id } = Route.useSearch();
  const reconcile = useServerFn(reconcileDodoSubscription);
  // Activating the membership right here (instead of waiting for the webhook)
  // so the plan shows immediately on return. Retries a few times because the
  // subscription can take a second to become queryable on Dodo's side.
  const [state, setState] = useState<"working" | "active" | "pending">("working");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function run() {
      attempts += 1;
      try {
        const result = await reconcile({
          data: { subscriptionId: subscription_id ?? undefined },
        });
        if (cancelled) return;
        if (result && "ok" in result && result.ok) {
          setState("active");
          return;
        }
      } catch {
        // fall through to retry / pending
      }
      if (cancelled) return;
      if (attempts < 4) {
        setTimeout(run, 2000); // brief backoff; Dodo may lag a moment
      } else {
        setState("pending");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [reconcile, subscription_id]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-brand border border-border bg-card p-8 text-center">
        {state === "active" ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <CheckIcon className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Welcome to your Care Membership</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your plan is active. Manage or cancel anytime from Settings.
            </p>
          </>
        ) : state === "working" ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <SpinnerGapIcon className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Activating your membership…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This only takes a moment. Please don't close this page.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <WarningCircleIcon className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Payment received</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment went through. Your membership will finish activating shortly — refresh
              Settings in a minute, or contact support if it doesn't appear.
            </p>
          </>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <Button
            asChild
            className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
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
