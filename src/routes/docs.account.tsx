import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
export const Route = createFileRoute("/docs/account")({
  head: () => ({ meta: [{ title: "Your account | SomeoneNear Docs" }] }),
  component: Page,
});
function Page() {
  return (
    <>
      <DocHeader
        eyebrow="SomeoneNear guides"
        title="Your account"
        intro="A private space that stays yours."
      />
      <DocSection title="Profile and timezone">
        <p>
          Update your name, preferences and timezone in Settings. Use a valid IANA timezone such as
          Asia/Kolkata.
        </p>
      </DocSection>
      <DocSection title="Signing out">
        <p>
          Sign out when you finish on a shared device. Your private workspace is cleared when your
          session ends or your account changes.
        </p>
      </DocSection>
      <DocSection title="Membership">
        <p>
          Settings shows your existing membership and available management controls. New purchases
          are currently unavailable.
        </p>
      </DocSection>
    </>
  );
}
