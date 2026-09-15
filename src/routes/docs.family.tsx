import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/family")({
  head: () => ({
    meta: [
      { title: "Family Circle | SomeoneNear Docs" },
      { name: "description", content: "Invite loved ones, share your plan, and keep the circle close." },
      { property: "og:title", content: "Family Circle | SomeoneNear Docs" },
      { property: "og:description", content: "Invite loved ones. Share care." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Family Circle"
        intro="One membership, everyone included."
      />

      <DocSection title="What it is">
        <p>Family Circle is your household on SomeoneNear. The plan owner invites members, and everyone shares the same monthly minute pool for listener calls.</p>
      </DocSection>

      <DocSection title="Invite someone">
        <Steps
          items={[
            { title: "Open Family Circle", body: "You'll see everyone who's already in." },
            { title: "Send an invite", body: "Copy the link or share it directly by WhatsApp, SMS, or email." },
            { title: "They accept", body: "Opening the link brings them to a simple sign-in. If they're new to SomeoneNear, we set them up automatically." },
            { title: "Set their role", body: "Choose Owner, Adult, Teen, Kid, or Cared-for." },
          ]}
        />
      </DocSection>

      <DocSection title="What each member sees">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>You</strong>, your own Companion chats, mood check-ins, insights.</li>
          <li><strong>Family owner</strong>, plan, billing, invites, session pool usage. Never chats or check-ins.</li>
          <li><strong>Other members</strong>, their own space, plus the shared listener pool.</li>
        </ul>
      </DocSection>

      <Callout tone="tip" title="Nobody reads anyone else's chats">
        Family membership shares the plan and minutes, not your private conversations or check-ins.
      </Callout>

      <TryItNow to="/family" label="Open Family Circle" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "How many people can I add?", a: "Together = 2, Family = up to 5, Care = larger. See Billing." },
            { q: "Can I remove someone?", a: "Yes, from Family Circle, tap the member and choose Remove." },
            { q: "Can a member leave on their own?", a: "Yes, any member can leave from their Account." },
          ]}
        />
      </DocSection>
    </>
  );
}
