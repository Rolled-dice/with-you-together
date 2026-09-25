import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { createDodoCheckout } from "@/lib/dodo.functions";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { ArrowLeftIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

const PriceParam = z.enum([
  "care_monthly_inr",
  "care_monthly_usd",
  "care_plus_monthly_inr",
  "care_plus_monthly_usd",
]);

const PRICE_LABELS: Record<z.infer<typeof PriceParam>, string> = {
  care_monthly_inr: "Care plan, ₹3,999 / month",
  care_monthly_usd: "Care plan, $49 / month",
  care_plus_monthly_inr: "Care Plus plan, ₹6,499 / month",
  care_plus_monthly_usd: "Care Plus plan, $79 / month",
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
      <DodoCheckout price={price} />
    </AppShell>
  );
}

function DodoCheckout({ price }: { price: z.infer<typeof PriceParam> }) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const result = await createDodoCheckout({
        data: {
          priceId: price,
          returnUrl: `${window.location.origin}/checkout/return`,
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-brand border border-border bg-card p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        You’ll complete this membership checkout securely on Dodo Payments. Your membership
        activates once the signed Dodo webhook is processed.
      </p>
      <Button
        onClick={startCheckout}
        disabled={loading}
        className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
      >
        {loading ? <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
        Continue to secure checkout
      </Button>
    </div>
  );
}
