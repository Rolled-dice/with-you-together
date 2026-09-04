import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/billing")({
  head: () => ({
    meta: [
      { title: "Billing & plans — SomeoneNear Docs" },
      { name: "description", content: "Plans, prices, upgrades, and refunds — the plain-English version." },
      { property: "og:title", content: "Billing & plans — SomeoneNear Docs" },
      { property: "og:description", content: "Plans and prices for SomeoneNear." },
    ],
  }),
  component: Page,
});

const plans = [
  { name: "Together", seats: "You + 1", minutes: "120 min / mo", usd: "$8.99", inr: "₹799" },
  { name: "Family", seats: "Up to 5", minutes: "300 min / mo", usd: "$15.99", inr: "₹1,499" },
  { name: "Care", seats: "Larger families", minutes: "Custom", usd: "$36.99", inr: "₹3,499" },
];

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Account"
        title="Billing & plans"
        intro="Simple plans that grow with your family. Cancel any time."
      />

      <DocSection title="Plans at a glance">
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Seats</th>
                <th className="py-2 pr-4">Listener minutes</th>
                <th className="py-2 pr-4">USD</th>
                <th className="py-2">INR</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans.map((p) => (
                <tr key={p.name}>
                  <td className="py-2 pr-4 font-semibold">{p.name}</td>
                  <td className="py-2 pr-4">{p.seats}</td>
                  <td className="py-2 pr-4">{p.minutes}</td>
                  <td className="py-2 pr-4">{p.usd}/mo</td>
                  <td className="py-2">{p.inr}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">All plans start with a 7-day free trial.</p>
      </DocSection>

      <DocSection title="Upgrading or downgrading">
        <p>Open <em>Billing</em> in your account and choose a new plan. Upgrades take effect immediately; downgrades apply at the end of your current cycle.</p>
      </DocSection>

      <DocSection title="Cancelling">
        <p>Cancel any time from Billing. You keep access until the end of your paid period. No cancellation fees.</p>
      </DocSection>

      <TryItNow to="/settings" label="Manage billing" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "Can I change currency?", a: "We bill in USD or INR based on your region. Contact us if you need to switch." },
            { q: "Do unused minutes roll over?", a: "No — the pool resets each month so everyone starts fresh." },
            { q: "Refunds?", a: "If something's wrong, write to us within 14 days and we'll make it right." },
          ]}
        />
      </DocSection>
    </>
  );
}
