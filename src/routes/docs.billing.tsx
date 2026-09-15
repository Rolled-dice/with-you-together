import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/billing")({
  head: () => ({
    meta: [
      { title: "Billing & plans | SomeoneNear Docs" },
      { name: "description", content: "Plans, prices, upgrades, and refunds, the plain-English version." },
      { property: "og:title", content: "Billing & plans | SomeoneNear Docs" },
      { property: "og:description", content: "Plans and prices for SomeoneNear." },
    ],
  }),
  component: Page,
});

const plans = [
  { name: "Care", seats: "You + 1", minutes: "18 Check-Ins / mo (15 min each)", ai: "Daily message allowance", usd: "$49" },
  { name: "Care Plus", seats: "Up to 5", minutes: "30 Check-Ins / mo (15 min each)", ai: "Unlimited", usd: "$79" },
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
                <th className="py-2 pr-4">Included Check-Ins</th>
                <th className="py-2 pr-4">Companion chat</th>
                <th className="py-2">Price (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans.map((p) => (
                <tr key={p.name}>
                  <td className="py-2 pr-4 font-semibold">{p.name}</td>
                  <td className="py-2 pr-4">{p.seats}</td>
                  <td className="py-2 pr-4">{p.minutes}</td>
                  <td className="py-2 pr-4">{p.ai}</td>
                  <td className="py-2">{p.usd}/mo</td>
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
            { q: "What currency do you bill in?", a: "All plans are billed in US dollars (USD). Your bank handles the conversion if your account is in another currency." },
            { q: "Do unused Check-Ins roll over?", a: "No, your Check-Ins reset each month so everyone starts fresh." },
            { q: "How much Companion chat do I get?", a: "Care includes a daily message allowance that refills every day. Care Plus includes unlimited Companion chat." },
            { q: "Refunds?", a: "If something's wrong, write to us within 14 days and we'll make it right." },
          ]}
        />
      </DocSection>
    </>
  );
}
