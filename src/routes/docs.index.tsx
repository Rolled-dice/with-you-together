import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/")({
  head: () => ({ meta: [{ title: "SomeoneNear guides | SomeoneNear Docs" }] }),
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
