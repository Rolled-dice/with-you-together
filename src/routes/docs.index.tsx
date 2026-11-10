import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "SomeoneNear Knowledge Base & Guides | SomeoneNear Docs" },
      {
        name: "description",
        content:
          "Official guides, tutorials, and support articles for SomeoneNear family circle, medication reminders, AI Companion, and listener calls.",
      },
      { property: "og:title", content: "SomeoneNear Knowledge Base & Guides | SomeoneNear Docs" },
      {
        property: "og:description",
        content: "Official guides, tutorials, and support articles for SomeoneNear family care and companion features.",
      },
      { property: "og:url", content: "https://someonenear.com/docs" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/docs" }],
  }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="SomeoneNear guides"
        intro="A little help finding your way around."
      />
      <DocSection title="Your private space">
        <p>
          Sign in to find your family circle, personal reminders, Companion conversations and
          scheduled messages.
        </p>
      </DocSection>
      <DocSection title="Choose what to share">
        <p>
          Your account and family membership determine which information is available to you. Review
          sharing preferences before inviting someone.
        </p>
      </DocSection>
    </>
  );
}
