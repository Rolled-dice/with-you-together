import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/listeners")({
  head: () => ({ meta: [{ title: "Feature availability | SomeoneNear Docs" }] }),
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
