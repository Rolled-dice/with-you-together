import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/faq")({
  head: () => ({ meta: [{ title: "Common questions | SomeoneNear Docs" }] }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="Common questions"
        intro="Clear answers, at your pace."
      />
      <DocSection title="Are device notifications enabled?">
        <p>
          Background push delivery is not available in this release. You can read your updates in
          the notification inbox while using the app.
        </p>
      </DocSection>
      <DocSection title="Can I send a voice message?">
        <p>
          Send Later supports scheduled voice messages for available family contacts. Recording
          requires browser microphone permission. Upload a supported recording if your browser
          cannot record.
        </p>
      </DocSection>
      <DocSection title="Can I use it on my phone?">
        <p>
          Yes. Your main navigation sits at the bottom of the screen on mobile. On desktop, use the
          sidebar.
        </p>
      </DocSection>
      <DocSection title="Does Companion replace professional help?">
        <p>
          No. Companion is an AI feature for everyday reflection. Use the Safety page for grounding
          resources and independent support services when needed.
        </p>
      </DocSection>
    </>
  );
}
