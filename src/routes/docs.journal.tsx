import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/journal")({
  head: () => ({
    meta: [
      { title: "Journal — BesideU Docs" },
      { name: "description", content: "A private space for your thoughts and moods." },
      { property: "og:title", content: "Journal — BesideU Docs" },
      { property: "og:description", content: "Private notes and moods, only for you." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Journal"
        intro="A quiet corner of BesideU that belongs only to you."
      />

      <DocSection title="What it is">
        <p>Journal lets you write down what's on your mind and tag how you're feeling. Every entry is private — no family member, admin, or listener can see it.</p>
      </DocSection>

      <DocSection title="When to use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>End-of-day wind-down.</li>
          <li>Making sense of a big feeling.</li>
          <li>Tracking small wins over time.</li>
        </ul>
      </DocSection>

      <DocSection title="How to use it">
        <Steps
          items={[
            { title: "New entry", body: "Open Journal and tap the plus button." },
            { title: "Write freely", body: "There's no length or format rule." },
            { title: "Add a mood", body: "Pick an emoji for how you feel — this powers your Insights." },
            { title: "Save", body: "Entries are auto-saved as you type." },
          ]}
        />
      </DocSection>

      <Callout tone="tip" title="Only you can see this">
        Journal is locked to your account. Even family owners can't read your entries.
      </Callout>

      <TryItNow to="/journal" label="Open Journal" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "Can I edit past entries?", a: "Yes — tap any entry to edit or delete it." },
            { q: "Can I export my journal?", a: "Yes, from Account → Data → Export." },
            { q: "Does Companion read my journal?", a: "No, unless you paste something into a chat yourself." },
          ]}
        />
      </DocSection>
    </>
  );
}
