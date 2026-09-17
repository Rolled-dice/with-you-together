import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { z } from "zod";
import { useCallback, useMemo, useState } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  getRazorpayEnvironment,
  openRazorpaySubscriptionCheckout,
} from "@/lib/razorpay";
import {
  createMembershipCheckout,
  createRazorpaySubscription,
} from "@/lib/billing.functions";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { ArrowLeftIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { PlanId } from "@/lib/currency";

const PriceParam = z.enum([
  "together_monthly_inr",
  "together_monthly_usd",
  "family_monthly_inr",
  "family_monthly_usd",
  "care_monthly_inr",
  "care_monthly_usd",
]);

const PRICE_LABELS: Record<z.infer<typeof PriceParam>, string> = {
  together_monthly_inr: "Together plan, ₹799 / month",
  together_monthly_usd: "Together plan, $8.99 / month",
  family_monthly_inr: "Family plan, ₹1,499 / month",
  family_monthly_usd: "Family plan, $15.99 / month",
  care_monthly_inr: "Care plan, ₹3,499 / month",
  care_monthly_usd: "Care plan, $36.99 / month",
};

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    price: PriceParam.parse(search.price),
  }),
  head: () => ({
    meta: [{ title: "Checkout | SomeoneNear" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { price } = Route.useSearch();
  const navigate = useNavigate();

  // INR prices are billed through Razorpay; USD through Stripe. The price key
  // encodes the currency suffix (e.g. care_monthly_inr).
  const isInr = price.endsWith("_inr");
  const plan = price.split("_")[0] as PlanId;

  return (
    <AppShell>
      <PaymentTestModeBanner />
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/settings" })}
          className="rounded-brand"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to settings
        </Button>
      </div>
      <PageHeader
        eyebrow="Care Membership"
        title={PRICE_LABELS[price as z.infer<typeof PriceParam>]}
        description="Secure checkout, cancel anytime from Settings."
      />
      {isInr ? (
        <RazorpayCheckout plan={plan} />
      ) : (
        <StripeCheckout price={price} />
      )}
    </AppShell>
  );
}

function StripeCheckout({ price }: { price: z.infer<typeof PriceParam> }) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await createMembershipCheckout({
      data: {
        priceId: price,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Missing client secret");
    return result.clientSecret;
  }, [price]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div id="checkout" className="rounded-brand border border-border bg-card p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

function RazorpayCheckout({ plan }: { plan: PlanId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const result = await createRazorpaySubscription({
        data: { plan, environment: getRazorpayEnvironment() },
      });
      if ("error" in result) throw new Error(result.error);

      await openRazorpaySubscriptionCheckout({
        subscriptionId: result.subscriptionId,
        description: "Care Membership",
        onSuccess: () => {
          toast.success("Payment received. Activating your membership…");
          // Activation is confirmed by webhook; settings polls the subscription.
          navigate({ to: "/settings" });
        },
        onDismiss: () => setLoading(false),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-brand border border-border bg-card p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        You'll be billed monthly in Indian Rupees through Razorpay. Your card or
        UPI mandate is set up securely, and you can cancel anytime from Settings.
      </p>
      <Button
        onClick={startCheckout}
        disabled={loading}
        className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
      >
        {loading ? (
          <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Continue to secure payment
      </Button>
    </div>
  );
}
