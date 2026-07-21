import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/listeners")({
  head: () => ({
    meta: [
      { title: "Listeners — WithU Docs" },
      { name: "description", content: "Book a real human to talk with, same day or later." },
      { property: "og:title", content: "Listeners — WithU Docs" },
      { property: "og:description", content: "Book a real human to talk with." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Listeners"
        intro="Warm, trained humans who show up on a call when you need one."
      />

      <DocSection title="What it is">
        <p>Listeners are real people — not therapists — trained to hold a supportive, judgment-free call. You can book same-day slots or plan ahead.</p>
      </DocSection>

      <DocSection title="How to book">
        <Steps
          items={[
            { title: "Browse listeners", body: "Open Listeners to see who's available, with short intros." },
            { title: "Pick a date and time", body: "Today is available if slots are open. Otherwise, choose any upcoming day." },
            { title: "Confirm", body: "Your session minutes are held for the booking." },
            { title: "Join the call", body: "Tap Join from the booking card at the scheduled time." },
          ]}
        />
      </DocSection>

      <Callout tone="info" title="Session minutes">
        Every plan comes with a monthly pool of minutes shared across your Family Circle. See <a className="underline" href="/docs/billing">Billing</a> for how many you get.
      </Callout>

      <TryItNow to="/listeners" label="Find a listener" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "Are listeners therapists?", a: "No. They're trained companions. For clinical support, please see the Safety page." },
            { q: "Can I cancel?", a: "Yes — cancel from the booking card. Minutes are returned if you cancel more than 30 minutes before." },
            { q: "Is the call recorded?", a: "No. Calls aren't recorded or stored." },
          ]}
        />
      </DocSection>
    </>
  );
}
