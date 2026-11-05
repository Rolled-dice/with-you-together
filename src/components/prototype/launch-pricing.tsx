import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { launchTestProductId } from "@/lib/launch-dodo-products";
import {
  LAUNCH_CATALOG_VERSION,
  LAUNCH_MARKETS,
  LAUNCH_PLANS,
  SHARED_LAUNCH_FEATURES,
  launchPrice,
  type MarketId,
} from "@/lib/launch-catalog";

export function LaunchPricing({ initialMarket = "us" }: { initialMarket?: MarketId }) {
  const [market, setMarket] = useState<MarketId>(initialMarket);
  const [ready, setReady] = useState(false);
  const changed = useRef(false);
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (!changed.current) setMarket(initialMarket);
  }, [initialMarket]);
  return (
    <section
      className="sn-plans"
      id="plans"
      aria-labelledby="plans-heading"
      data-catalog-version={LAUNCH_CATALOG_VERSION}
    >
      <span className="sn-section-label">Care that fits your family</span>
      <h2 id="plans-heading">Two transparent monthly care plans</h2>
      <div className="sn-pricing-toolbar sn-plans-intro">
        <label>
          Show prices for{" "}
          <select
            aria-label="Select pricing market"
            disabled={!ready}
            value={market}
            onChange={(event) => {
              changed.current = true;
              setMarket(event.target.value as MarketId);
            }}
          >
            {LAUNCH_MARKETS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.currency})
              </option>
            ))}
          </select>
        </label>
        <p>
          {import.meta.env.VITE_DODO_MODE === "test"
            ? "Dodo test checkout is available in supported markets. No real charges."
            : "Launch catalog preview. New subscriptions are not currently available."}
        </p>
      </div>
      <div className="sn-plan-grid">
        {(["care", "care_plus"] as const).map((id) => {
          const plan = LAUNCH_PLANS[id];
          return (
            <article
              key={id}
              className={`sn-plan ${id === "care_plus" ? "sn-plan-highlight" : ""}`}
            >
              <div className="sn-plan-label">
                <strong>{plan.name}</strong>
                {id === "care_plus" && <span>Most chosen</span>}
              </div>
              <p className="sn-plan-price">
                {launchPrice(id, market)}
                <span>/ month</span>
              </p>
              <p>
                {plan.calls} calls shared by up to {plan.people} people, including the subscription
                owner.
              </p>
              <ul>
                {[
                  `${plan.calls} human listener calls per month`,
                  `Up to ${plan.people} people`,
                  ...SHARED_LAUNCH_FEATURES,
                ].map((feature) => (
                  <li key={feature}>
                    <CheckCircleIcon size={18} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="sn-launch-offer">
                Launch offer: 7 days free with {plan.trialCalls} shared trial calls, then{" "}
                {launchPrice(id, market, true)} for the first paid month (30% off).{" "}
                {launchPrice(id, market)} per month after that.
              </p>
              <Link
                className={`sn-button ${id === "care_plus" ? "sn-button-gold" : ""}`}
                to={
                  import.meta.env.VITE_DODO_MODE === "test" && launchTestProductId(market, id)
                    ? "/checkout"
                    : "/docs/billing"
                }
                search={
                  import.meta.env.VITE_DODO_MODE === "test" && launchTestProductId(market, id)
                    ? { plan: id, market }
                    : undefined
                }
              >
                {import.meta.env.VITE_DODO_MODE === "test"
                  ? launchTestProductId(market, id)
                    ? `Try ${plan.name} checkout`
                    : `Checkout unavailable in ${LAUNCH_MARKETS.find((m) => m.id === market)?.currency}`
                  : `Explore ${plan.name}`}
              </Link>
            </article>
          );
        })}
      </div>
      <p className="sn-launch-terms">
        Both plans include the same features. Call allowances are shared across the plan. Refund
        requests will be available for 7 days after the first successful charge. Taxes and
        payment-method availability will be confirmed before checkout opens. Existing subscriptions
        keep their purchased terms.
      </p>
    </section>
  );
}
