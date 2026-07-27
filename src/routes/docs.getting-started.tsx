import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/getting-started")({
  head: () => ({
    meta: [
      { title: "Getting started — BesideU Docs" },
      { name: "description", content: "Create your BesideU account, finish onboarding, pick a plan, and invite family." },
      { property: "og:title", content: "Getting started — BesideU Docs" },
      { property: "og:description", content: "Set up BesideU in a few minutes." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Start here"
        title="Getting started"
        intro="Everything you need to go from signing up to your first check-in."
      />

      <DocSection title="1. Create your account">
        <p>Use your email or continue with Google. We'll send a magic link — no password to remember.</p>
        <Callout tone="tip" title="Under 13?">BesideU is for people 13 and older. Family members below 13 should be added by a parent as a cared-for profile.</Callout>
      </DocSection>

      <DocSection title="2. Finish onboarding">
        <p>We ask a few short questions — your name, who you're caring for, and how you'd like BesideU to talk to you. It takes about a minute and you can change everything later.</p>
      </DocSection>

      <DocSection title="3. Choose a plan">
        <Steps
          items={[
            { title: "Together", body: "Just you and one loved one." },
            { title: "Family", body: "Up to 5 people share the same minute pool." },
            { title: "Care", body: "For larger families or intensive support." },
          ]}
        />
        <p className="text-sm text-muted-foreground">Every plan starts with a 7-day free trial. You can cancel any time.</p>
      </DocSection>

      <DocSection title="4. Invite your family">
        <p>Open <em>Family Circle</em> and send invite links by WhatsApp, SMS, or email. When they accept, they join your circle and share your session minutes.</p>
      </DocSection>

      <TryItNow to="/auth" label="Start now" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "Do I need a credit card to try?", a: "No. The trial is free and doesn't ask for one." },
            { q: "Can I switch plans later?", a: "Yes — upgrade or downgrade any time from Billing." },
            { q: "What if my parent isn't tech-savvy?", a: "Send them the invite link — it opens BesideU directly. The chat and calls are designed to be simple for older adults." },
          ]}
        />
      </DocSection>
    </>
  );
}
