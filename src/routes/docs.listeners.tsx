import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/listeners")({
  head: () => ({
    meta: [
      { title: "Listener Calls & Feature Availability | SomeoneNear Docs" },
      {
        name: "description",
        content:
          "Learn about SomeoneNear listener calls, scheduling friendly phone conversations for elderly loved ones, and service availability.",
      },
      { property: "og:title", content: "Listener Calls & Feature Availability | SomeoneNear Docs" },
      {
        property: "og:description",
        content: "Learn about SomeoneNear listener calls and service availability for your region.",
      },
      { property: "og:url", content: "https://someonenear.com/docs/listeners" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/docs/listeners" }],
  }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="Feature availability"
        intro="Your account shows the services currently available to you."
      />
      <DocSection title="Explore your space">
        <p>
          Use the main navigation to find Companion, Family, Reminders, Send Later, Insights and
          Settings. Only supported actions are shown.
        </p>
      </DocSection>
    </>
  );
}
