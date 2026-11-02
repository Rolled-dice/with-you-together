import { createFileRoute } from "@tanstack/react-router";
import {
  DocHeader,
  DocSection,
  Steps,
  Callout,
  MiniFaq,
  TryItNow,
} from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/companion")({
  head: () => ({
    meta: [
      { title: "Companion | SomeoneNear Docs" },
      {
        name: "description",
        content: "How to chat with your SomeoneNear Companion, a warm AI that's always awake.",
      },
      { property: "og:title", content: "Companion | SomeoneNear Docs" },
      { property: "og:description", content: "A warm AI chat, always awake." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Feature"
        title="Companion"
        intro="A gentle, always-on chat. Think of it as a friend who has time, no matter the hour."
      />

      <DocSection title="What it is">
        <p>
          Companion is a caring AI chat. It listens, remembers what you tell it, and replies in a
          tone you choose, warm, playful, or calm.
        </p>
      </DocSection>

      <DocSection title="When to use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Late-night thoughts you don't want to put on anyone.</li>
          <li>A quick vent between meetings.</li>
          <li>Practising a hard conversation before you have it.</li>
          <li>Just wanting a hello.</li>
        </ul>
      </DocSection>

      <DocSection title="How to use it">
        <Steps
          items={[
            { title: "Open Companion", body: "From the app home, tap Companion." },
            { title: "Type or speak", body: "Start with anything on your mind. No wrong opener." },
            {
              title: "Pick a tone",
              body: "Warm, playful, or calm | change it any time from the top of the chat.",
            },
            {
              title: "End when ready",
              body: "Tap End session to close. Your chat is saved so you can pick it back up.",
            },
          ]}
        />
      </DocSection>

      <Callout tone="info" title="Privacy">
        Your Companion chats are visible only to you. Family members and admins can't read them.
      </Callout>

      <TryItNow to="/companion" label="Open Companion" />

      <DocSection title="Common questions">
        <MiniFaq
          items={[
            {
              q: "Is Companion therapy?",
              a: "No. It's supportive company, not medical care. If you need help, see the Safety page.",
            },
            {
              q: "Can I delete a chat?",
              a: "Yes, long-press a conversation and choose Delete. It's gone from your account.",
            },
            {
              q: "Does it remember me?",
              a: "It keeps light memory (name, tone, a few preferences) so replies feel personal. You can clear memory in settings.",
            },
          ]}
        />
      </DocSection>
    </>
  );
}
