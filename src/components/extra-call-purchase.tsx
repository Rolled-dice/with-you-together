import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyExtraCalls, buyExtraCall } from "@/lib/call-credits.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ExtraCallPurchase() {
  const options = useServerFn(getMyExtraCalls);
  const buy = useServerFn(buyExtraCall);
  const query = useQuery({ queryKey: ["extra-calls"], queryFn: () => options() });
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [accepted, setAccepted] = useState(false);
  const mut = useMutation({
    mutationFn: () =>
      buy({
        data: { currency, expiry_accepted: true, expires_at: query.data!.purchase_expires_at! },
      }),
    onSuccess: (result) => {
      window.location.assign(result.checkoutUrl);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 border-t border-border py-4">
      <h3 className="text-lg font-semibold">Extra calls</h3>
      {query.data && query.data.available > 0 && (
        <p>
          {query.data.available} purchased sessions remaining
          {query.data.expires_at
            ? `, earliest expiry ${new Date(query.data.expires_at).toLocaleString()}`
            : ""}
          .
        </p>
      )}
      {query.data?.enabled && query.data.can_buy && query.data.purchase_expires_at ? (
        <>
          <label className="grid gap-2">
            One 15-minute call
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
              className="family-select"
            >
              {query.data.offers.map((offer) => (
                <option key={offer.currency} value={offer.currency}>
                  {new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: offer.currency,
                  }).format(offer.amount / 100)}
                </option>
              ))}
            </select>
          </label>
          <p>
            Expires {new Date(query.data.purchase_expires_at).toLocaleString()}. Your call must
            finish before this time.
          </p>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              I understand this session expires at the end of my current billing period and must be
              used before then.
            </span>
          </label>
          <Button disabled={!accepted || mut.isPending} onClick={() => mut.mutate()}>
            Buy one call
          </Button>
        </>
      ) : (
        <Button variant="outline" disabled>
          {query.isError ? "Call purchases could not be loaded" : "Extra calls unavailable"}
        </Button>
      )}
    </div>
  );
}
