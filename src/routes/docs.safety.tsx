import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Callout, MiniFaq } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/safety")({
  head: () => ({
    meta: [
      { title: "Safety | SomeoneNear Docs" },
      { name: "description", content: "How to get help fast, and what SomeoneNear is not." },
      { property: "og:title", content: "Safety | SomeoneNear Docs" },
      { property: "og:description", content: "Crisis resources and safety guidance." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Important"
        title="Safety"
        intro="SomeoneNear is a warm space, but it isn't therapy or an emergency service."
      />

      <Callout tone="warn" title="If you're in immediate danger">
        Call your local emergency number right away. In India dial <strong>112</strong>. In the US dial <strong>911</strong>. In the UK dial <strong>999</strong>.
      </Callout>

      <DocSection title="Talking to someone trained">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>iCall (India):</strong> +91 9152987821</li>
          <li><strong>988 Suicide & Crisis Lifeline (US):</strong> dial 988</li>
          <li><strong>Samaritans (UK):</strong> 116 123</li>
          <li><strong>Lifeline (AU):</strong> 13 11 14</li>
        </ul>
      </DocSection>

      <DocSection title="How SomeoneNear supports you">
        <p>Companion and Listeners are here to be with you, to hear you out, help you slow down, and remind you you're not alone. If a conversation raises concern for your safety, SomeoneNear will always surface these resources.</p>
      </DocSection>

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "Is Companion a therapist?", a: "No. It's a supportive AI companion, not a clinician." },
            { q: "Are listeners trained?", a: "Yes, in warm, non-judgmental support. They aren't therapists either." },
          ]}
        />
      </DocSection>
    </>
  );
}
