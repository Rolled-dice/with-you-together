import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/listeners")({
  head: () => ({
    meta: [
      { title: "Listeners | SomeoneNear Docs" },
      { name: "description", content: "Book a real human to call you on your phone, with at least two hours' notice." },
      { property: "og:title", content: "Listeners | SomeoneNear Docs" },
      { property: "og:description", content: "Book a real human to call you." },
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
        intro="Warm, trained humans who call you on your phone when you need someone to talk to."
      />

      <DocSection title="What it is">
        <p>
          Listeners are real people, not therapists, trained to hold a supportive, judgment-free
          conversation. When it's time, the listener calls the mobile number on your profile, so
          there's no link to open and nothing to install.
        </p>
      </DocSection>

      <DocSection title="How to book">
        <Steps
          items={[
            { title: "Add and verify your number", body: "Before your first booking we text or call a short code to your mobile, so calls always reach the right person." },
            { title: "Open Listeners", body: "Pick a day and time that suits you | today works if the slot is at least two hours away." },
            { title: "Confirm", body: "We'll hold your session minutes for the booking and send a gentle reminder as it approaches." },
            { title: "Answer the call", body: "At the scheduled time your phone rings. Just pick up | that's the whole thing." },
          ]}
        />
      </DocSection>

      <Callout tone="info" title="Why two hours' notice?">
        A listener sets aside real time for you. The two-hour minimum gives them space to prepare
        and makes sure every booked call actually happens.
      </Callout>

      <TryItNow to="/listeners" label="Find a listener" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "Are listeners therapists?", a: "No. They're trained companions. For clinical support, please see the Safety page." },
            { q: "Can I cancel?", a: "Yes, cancel from the booking card. Minutes are returned if you cancel more than 30 minutes before." },
            { q: "Is the call recorded?", a: "Calls may be recorded for quality and safety, and you'll always see a clear notice in the app when recording is on. Recordings are never shared with your family." },
            { q: "Can I change the number you call me on?", a: "Yes, update your mobile number in Settings. We'll ask you to verify the new number with a quick code." },
          ]}
        />
      </DocSection>
    </>
  );
}
