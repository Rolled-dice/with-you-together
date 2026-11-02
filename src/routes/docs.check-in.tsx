import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/check-in")({
  head: () => ({ meta: [{ title: "Your updates | SomeoneNear Docs" }] }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="Your updates"
        intro="Stay aware of the moments that matter."
      />
      <DocSection title="In-app notifications">
        <p>
          Open the notification bell to read updates available to your account. Mark updates as read
          or dismiss them when you are finished.
        </p>
      </DocSection>
      <DocSection title="Device notifications">
        <p>
          Dashboard and Settings show the browser’s permission state. Background push check-ins are
          not available in this release. Browser permission alone does not mean a message has been
          delivered.
        </p>
      </DocSection>
      <DocSection title="Private reflection">
        <p>
          You can record how you feel in Insights. Your private mood entries are separate from
          family notifications.
        </p>
      </DocSection>
    </>
  );
}
