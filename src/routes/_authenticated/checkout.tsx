import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { createLaunchCheckout } from "@/lib/launch-checkout.functions";
import { isMarketId, LAUNCH_PLANS, launchPrice, type MarketId } from "@/lib/launch-catalog";
import { launchTestProductId } from "@/lib/launch-dodo-products";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (search: Record<string, unknown>) =>
    z
      .object({
        price: z
          .enum([
            "care_monthly_inr",
            "care_monthly_usd",
            "care_plus_monthly_inr",
            "care_plus_monthly_usd",
          ])
          .optional(),
        plan: z.enum(["care", "care_plus"]).optional(),
        market: z.custom<MarketId>(isMarketId).optional(),
        completed: z.coerce.string().optional(),
        payment_status: z.coerce.string().optional(),
        status: z.coerce.string().optional(),
      })
      .parse(search),
  head: () => ({ meta: [{ title: "Membership checkout | SomeoneNear" }] }),
  component: CheckoutPage,
});
function CheckoutPage() {
  const search = Route.useSearch();
  const plan = search.plan ?? (search.price?.startsWith("care_plus") ? "care_plus" : "care");
  const market = search.market ?? (search.price?.endsWith("inr") ? "in" : "us");
  const terms = LAUNCH_PLANS[plan];
  const paymentStatus = (search.payment_status ?? search.status ?? "").toLowerCase();
  const paymentFailed = ["failed", "cancelled", "canceled", "expired"].includes(paymentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dodoMode = import.meta.env.VITE_DODO_MODE === "live" ? "live" : "test";
  const available = dodoMode === "live" || !!launchTestProductId(market, plan);
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const session = await createLaunchCheckout({ data: { plan, market } });
      window.location.assign(session.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to start Dodo ${dodoMode} checkout.`);
      setBusy(false);
    }
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow={`Dodo ${dodoMode} mode`}
        title={`${terms.name} — ${launchPrice(plan, market)} / month`}
        description={
          dodoMode === "live"
            ? "Complete your SomeoneNear membership checkout securely with Dodo Payments."
          : "Try the subscription checkout in Dodo’s sandbox. No real payment will be collected."
        }
      />
      <section className="sn-panel space-y-4">
        <p>
          7 days free with {terms.trialCalls} shared trial calls. The first paid month is{" "}
          {launchPrice(plan, market, true)} (30% off), then {launchPrice(plan, market)} per month.
          Taxes are shown at checkout.
        </p>
        <p>
          {terms.calls} shared monthly calls for up to {terms.people} people, including the owner.
          Both plans include the same features.
        </p>
        <p className="text-sm text-muted-foreground">
          {dodoMode === "live"
            ? "A payment method is required for the trial. Membership access begins only after a verified Dodo webhook."
            : "A payment method is required for the trial. This sandbox checkout does not activate a live membership."}
        </p>
        {paymentFailed ? (
          <p role="alert" className="text-destructive">
            The payment was not completed. No membership was activated and no charge was confirmed.
            You can try checkout again below.
          </p>
        ) : search.completed ? (
          <p role="status">
            You’ve returned from Dodo checkout. Membership activation is confirmed only after the
            payment webhook is received.
          </p>
        ) : null}
        {!available && (
          <p role="status">
            Test checkout is not available for this market yet. Your requested prices have been
            preserved.
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button onClick={checkout} disabled={busy || !available}>
          {busy
            ? `Opening Dodo ${dodoMode} checkout…`
            : `Continue to Dodo ${dodoMode} checkout`}
        </Button>
        <p>
          <Link to="/settings">Back to settings</Link>
        </p>
      </section>
    </AppShell>
  );
}
