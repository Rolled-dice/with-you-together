import { createFileRoute } from "@tanstack/react-router";
import {
  Callout,
  DocHeader,
  DocSection,
  MiniFaq,
  Steps,
  TryItNow,
} from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/send-later")({
  head: () => ({
    meta: [
      { title: "Send It Later | SomeoneNear Docs" },
      {
        name: "description",
        content:
          "Write, record, or film a message now and choose the day it should arrive — a birthday, an anniversary, or any moment you want to be there for.",
      },
      { property: "og:title", content: "Send It Later | SomeoneNear Docs" },
      {
        property: "og:description",
        content: "Schedule a text, voice, or video message to be delivered on a future day.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Send It Later"
        intro="Some moments you know are coming, even when you can't be there for them. Write, record, or film a message now and choose the day it arrives."
      />

      <DocSection title="What it is">
        <p>
          Send It Later holds a message for you until the day you choose, then delivers it. A
          birthday note for a parent, a steady voice before a hospital appointment, a video for an
          anniversary you'll be away for — you prepare it in a calm moment, and it turns up right on
          time without you having to remember.
        </p>
      </DocSection>

      <DocSection title="Three kinds of message">
        <Steps
          items={[
            {
              title: "Write a note",
              body: "Type a message. Good for the words you want to get exactly right.",
            },
            {
              title: "Record your voice",
              body: "Sometimes hearing you is what matters. Record a voice message straight from your browser.",
            },
            {
              title: "Film a video",
              body: "For the moments a face says more than words. Record a short video the same way.",
            },
          ]}
        />
      </DocSection>

      <DocSection title="How it works">
        <Steps
          items={[
            {
              title: "Choose who it's for",
              body: "Pick a contact — someone in your Family Circle, or anyone you add.",
            },
            {
              title: "Write, record, or film",
              body: "Create the message however feels right for the moment.",
            },
            {
              title: "Pick the delivery day",
              body: "Choose when it should arrive. We hold it safely until then.",
            },
            {
              title: "We deliver it",
              body: "On the day, your message is sent. You can cancel any time before it goes.",
            },
          ]}
        />
      </DocSection>

      <Callout tone="tip" title="Messages you receive gather in one place">
        When someone schedules a message for you, it appears in your received list on the day it's
        delivered — a quiet inbox for the things people wanted you to have.
      </Callout>

      <Callout tone="info" title="You're always in control">
        A scheduled message is never final until it's delivered. Change your mind and you can cancel
        it right up to the moment it would send.
      </Callout>

      <TryItNow to="/send-later" label="Open Send It Later" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            {
              q: "Can I cancel a scheduled message?",
              a: "Yes. Anything still waiting to be delivered can be cancelled from your Send It Later list.",
            },
            {
              q: "Where are my voice and video recordings stored?",
              a: "Privately, tied to your account. Only you and the person you're sending to are involved.",
            },
            {
              q: "How far ahead can I schedule?",
              a: "As far as you like — a message for next week or next year is held the same way.",
            },
            {
              q: "What if I miss a delivery?",
              a: "You don't have to be online. Once scheduled, delivery happens on its own on the chosen day.",
            },
          ]}
        />
      </DocSection>
    </>
  );
}
