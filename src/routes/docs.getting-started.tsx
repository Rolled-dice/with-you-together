import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/getting-started")({
  head: () => ({ meta: [{ title: "Getting started | SomeoneNear Docs" }] }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="Getting started"
        intro="Make yourself at home, one step at a time."
      />
      <DocSection title="Create your account">
        <p>
          Sign in and complete your profile. Check your timezone so dates and scheduled messages
          reflect your day.
        </p>
      </DocSection>
      <DocSection title="Find your people">
        <p>
          Open Family to see your circle and available invitation controls. Membership requirements
          and permissions apply.
        </p>
      </DocSection>
      <DocSection title="Start small">
        <p>
          Add a reminder, write in your journal or begin a private Companion conversation. There is
          no need to do everything at once.
        </p>
      </DocSection>
    </>
  );
}
