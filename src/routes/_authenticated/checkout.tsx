import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { z } from "zod";
import { useCallback, useMemo } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createMembershipCheckout } from "@/lib/billing.functions";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { ArrowLeft } from "lucide-react";

const PriceParam = z.enum([
  "together_monthly_inr",
  "together_monthly_usd",
  "family_monthly_inr",
  "family_monthly_usd",
  "care_monthly_inr",
  "care_monthly_usd",
  // legacy
  "together_monthly",
  "family_monthly",
  "together_yearly",
  "family_yearly",
]);

const PRICE_LABELS: Record<z.infer<typeof PriceParam>, string> = {
  together_monthly_inr: "Together plan — ₹799 / month",
  together_monthly_usd: "Together plan — $8.99 / month",
  family_monthly_inr: "Family plan — ₹1,499 / month",
  family_monthly_usd: "Family plan — $15.99 / month",
  care_monthly_inr: "Care plan — ₹3,499 / month",
  care_monthly_usd: "Care plan — $36.99 / month",
  together_monthly: "Together plan (monthly)",
  family_monthly: "Family plan (monthly)",
  together_yearly: "Together plan (yearly)",
  family_yearly: "Family plan (yearly)",
};

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    price: PriceParam.parse(search.price),
  }),
  head: () => ({
    meta: [{ title: "Checkout — SomeoneNear" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { price } = Route.useSearch();
  const navigate = useNavigate();

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
    <AppShell>
      <PaymentTestModeBanner />
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/settings" })}
          className="rounded-brand"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to settings
        </Button>
      </div>
      <PageHeader
        eyebrow="Care Membership"
        title={PRICE_LABELS[price as z.infer<typeof PriceParam>]}
        description="Secure checkout — cancel anytime from Settings."
      />
      <div id="checkout" className="rounded-brand border border-border bg-card p-2">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </AppShell>
  );
}
