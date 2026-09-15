import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

const TITLE = "Check-In | SomeoneNear Docs";
const DESCRIPTION =
  "A Check-In is a short call from a SomeoneNear team member to someone you love, with an update added to your family dashboard afterwards.";

export const Route = createFileRoute("/docs/check-in")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Check-In"
        intro="Someone should know how they're doing. A Check-In is a simple way to make sure someone you care about is okay, even when you can't be there yourself."
      />

      <DocSection title="Scheduled Check-In">
        <p>
          A family member schedules a call for a specific time. At that time a SomeoneNear team
          member connects with their loved one and checks in on how they're doing, how their day
          went, whether they've eaten, had water, taken their regular medication if applicable, or
          simply how they're feeling.
        </p>
        <p>
          After the call, the relevant update is added to the family dashboard, so the family member
          has a better idea of how their loved one is doing.
        </p>
      </DocSection>

      <DocSection title="On-Demand Check-In">
        <p>
          Sometimes you don't want to wait for the scheduled call. Maybe someone comes home from
          work early, is having a difficult day, feels low, or simply wants someone to talk to.
        </p>
        <p>
          In that situation they can request an earlier Check-In or connect with SomeoneNear
          directly. If a trained human listener is available, the call can be taken right then,
          otherwise it's rescheduled to the nearest suitable time.
        </p>
      </DocSection>

      <DocSection title="How a Check-In works">
        <Steps
          items={[
            { title: "Add and verify the number", body: "We text a short code to the mobile number so calls always reach the right person." },
            { title: "Schedule the call", body: "Pick a day and time. Scheduled calls need at least two hours' notice." },
            { title: "We call them", body: "Their phone rings at the chosen time. Nothing to install, no link to open." },
            { title: "Read the update", body: "A short, respectful summary appears on the family dashboard." },
          ]}
        />
      </DocSection>

      <Callout tone="info" title="What a Check-In is not">
        The purpose isn't to diagnose, provide therapy, or understand someone's soul. It's to be
        present, listen, ask the right everyday questions, and give families a clearer picture of how
        their loved one is doing. SomeoneNear is everyday human presence and care, especially when
        the people who care can't be there.
      </Callout>

      <TryItNow to="/listeners" label="Schedule a Check-In" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "How long is a Check-In call?", a: "Each Check-In is a 15-minute call. Plans include 18 or 30 Check-Ins a month." },
            { q: "Who makes the call?", a: "A trained SomeoneNear team member, a human listener, not a bot." },
            { q: "What ends up on the family dashboard?", a: "A short everyday update: how they sounded, whether they ate, had water, took medication if relevant. Private conversation details stay private." },
            { q: "Can they refuse the call?", a: "Always. Nobody is obliged to pick up, and we never pressure anyone." },
          ]}
        />
      </DocSection>
    </>
  );
}
