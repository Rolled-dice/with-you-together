import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection, Steps, Callout, MiniFaq, TryItNow } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/account")({
  head: () => ({
    meta: [
      { title: "Your account — BesideU Docs" },
      { name: "description", content: "Profile, notifications, and deleting your BesideU account." },
      { property: "og:title", content: "Your account — BesideU Docs" },
      { property: "og:description", content: "Manage your BesideU account." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Account"
        title="Your account"
        intro="Small settings that make BesideU feel like yours."
      />

      <DocSection title="Profile">
        <p>Update your name, photo, and pronouns from <em>Account → Profile</em>. Changes show up right away in your Companion and Family Circle.</p>
      </DocSection>

      <DocSection title="Notifications">
        <Steps
          items={[
            { title: "Daily check-in", body: "A gentle reminder at your chosen time." },
            { title: "Family activity", body: "Only high-level events — never anyone's private content." },
            { title: "Booking reminders", body: "10 minutes before your listener call." },
          ]}
        />
      </DocSection>

      <DocSection title="Change email or password">
        <p>Open <em>Account → Sign-in</em>. You'll get a confirmation email to make the change.</p>
      </DocSection>

      <DocSection title="Delete your account">
        <p>From <em>Account → Data</em>, choose <strong>Delete account</strong>. This removes your chats, journal, insights, and profile within 30 days.</p>
        <Callout tone="warn" title="This can't be undone">Consider exporting your journal first if you want a copy.</Callout>
      </DocSection>

      <TryItNow to="/settings" label="Open account settings" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            { q: "What happens to my family plan if I delete?", a: "Ownership transfers to the next adult in your circle, or the plan ends if you're the only owner." },
            { q: "Can I pause notifications?", a: "Yes — set quiet hours from Notifications." },
          ]}
        />
      </DocSection>
    </>
  );
}
