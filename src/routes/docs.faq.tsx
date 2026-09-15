import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, MiniFaq } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/faq")({
  head: () => ({
    meta: [
      { title: "FAQ | SomeoneNear Docs" },
      { name: "description", content: "Answers to the most common questions about SomeoneNear." },
      { property: "og:title", content: "FAQ, SomeoneNear Docs" },
      { property: "og:description", content: "Answers to common questions about SomeoneNear." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader eyebrow="Help" title="Frequently asked questions" />
      <MiniFaq
        items={[
          { q: "Is SomeoneNear therapy?", a: "No. SomeoneNear is warm supportive company, chat, mood check-ins, and calls with trained listeners. For clinical care, please see a licensed professional." },
          { q: "Who can read my Companion chats?", a: "Only you. Family members and owners can't read your private content." },
          { q: "Can I use SomeoneNear without a family?", a: "Absolutely, the Together plan works for one person." },
          { q: "How do listener minutes work?", a: "Every plan includes a monthly pool. Any family member can use them until the pool runs out." },
          { q: "How do listener calls reach me?", a: "The listener calls the verified mobile number on your profile, no app or link needed. Bookings need at least two hours' notice." },
          { q: "Can SomeoneNear remind me to take my medicine?", a: "Yes, add medicines by scanning a prescription photo or typing them in, and we'll nudge you at each dose time. See the Medication page." },
          { q: "What happens after my free trial?", a: "You keep your account and can pick a plan any time. Trial content isn't deleted." },
          { q: "Can I use SomeoneNear in Hindi (or other languages)?", a: "Companion understands major languages including Hindi. We're adding more UI translations soon." },
          { q: "Does SomeoneNear work on desktop?", a: "Yes, SomeoneNear works on any modern browser. Phone is where most people spend time." },
          { q: "Can kids use SomeoneNear?", a: "Kids 13+ can have their own account. Younger children can be added as cared-for profiles by a parent." },
          { q: "How do I contact support?", a: "Use the Feedback button in the app, or email support from your Account page." },
          { q: "How do I delete everything?", a: "From Account → Data → Delete account. See the Account page for details." },
        ]}
      />
    </>
  );
}
