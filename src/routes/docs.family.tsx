import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/family")({
  head: () => ({ meta: [{ title: "Family circle | SomeoneNear Docs" }] }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="Family circle"
        intro="Keep your people close, with sharing you control."
      />
      <DocSection title="Invitations">
        <p>
          Eligible members can create a circle and invite family. An invitation must be accepted
          before someone becomes a member.
        </p>
      </DocSection>
      <DocSection title="Your role">
        <p>
          Available actions depend on your family role and membership. Review the members and
          pending invitations in Family.
        </p>
      </DocSection>
      <DocSection title="Messages">
        <p>
          Send Later lets you schedule a text, voice or video message for an available family
          recipient. Shared media-vault uploads are not enabled in this release.
        </p>
      </DocSection>
    </>
  );
}
