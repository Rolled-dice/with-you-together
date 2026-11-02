import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
import { PLAN_DISPLAY } from "@/lib/currency";
export const Route = createFileRoute("/docs/billing")({
  head: () => ({ meta: [{ title: "Membership | SomeoneNear Docs" }] }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Account"
        title="Your membership"
        intro="Review your current membership in Settings."
      />
      <DocSection title="Existing plans">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(PLAN_DISPLAY).map(([id, plan]) => (
            <article key={id} className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold">{plan.name}</h2>
              <p>
                {plan.inrLabel} / {plan.usdLabel} per month
              </p>
              <ul>
                {plan.bullets
                  .filter((b) => !/call|check-in|telnyx|safety net/i.test(b))
                  .map((b) => (
                    <li key={b}>{b}</li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      </DocSection>
      <DocSection title="Manage your account">
        <p>
          Existing subscription details and available cancellation controls remain in Settings. New
          purchases and plan switches are not available in this release.
        </p>
      </DocSection>
    </>
  );
}
