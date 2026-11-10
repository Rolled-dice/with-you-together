import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/insights")({
  head: () => ({
    meta: [
      { title: "Mood Insights & Wellbeing Trends | SomeoneNear Docs" },
      {
        name: "description",
        content: "Understand weekly mood trends, reflection logs, and gentle family wellness indicators over time.",
      },
      { property: "og:title", content: "Mood Insights & Wellbeing Trends | SomeoneNear Docs" },
      { property: "og:description", content: "Gentle mood patterns and private wellness reflections over time." },
      { property: "og:url", content: "https://someonenear.com/docs/insights" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/docs/insights" }],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Insights"
        intro="A soft mirror for your feelings, never a report card."
      />

      <DocSection title="What you'll see">
        <ul className="list-disc space-y-1 pl-5">
          <li>Weekly mood trend from your mood check-ins.</li>
          <li>Streaks and check-in frequency.</li>
          <li>Gentle nudges when a rough week appears.</li>
        </ul>
      </DocSection>

      <Callout tone="info" title="Private by default">
        Insights are only visible to you. Family members and owners don't see your moods.
      </Callout>

      <TryItNow to="/insights" label="Open Insights" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            {
              q: "Do I need to check in every day?",
              a: "No, even a couple of check-ins a week shape the trend.",
            },
            { q: "Can I turn off Insights?", a: "Yes, from Account → Preferences." },
          ]}
        />
      </DocSection>
    </>
  );
}
