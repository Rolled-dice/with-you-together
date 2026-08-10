import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, MiniFaq } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — BesideU Docs" },
      { name: "description", content: "Answers to the most common questions about BesideU." },
      { property: "og:title", content: "FAQ — BesideU Docs" },
      { property: "og:description", content: "Answers to common questions about BesideU." },
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
          { q: "Is BesideU therapy?", a: "No. BesideU is warm supportive company — chat, mood check-ins, and calls with trained listeners. For clinical care, please see a licensed professional." },
          { q: "Who can read my Companion chats?", a: "Only you. Family members and owners can't read your private content." },
          { q: "Can I use BesideU without a family?", a: "Absolutely — the Together plan works for one person." },
          { q: "How do listener minutes work?", a: "Every plan includes a monthly pool. Any family member can use them until the pool runs out." },
          { q: "What happens after my free trial?", a: "You keep your account and can pick a plan any time. Trial content isn't deleted." },
          { q: "Can I use BesideU in Hindi (or other languages)?", a: "Companion understands major languages including Hindi. We're adding more UI translations soon." },
          { q: "Does BesideU work on desktop?", a: "Yes — BesideU works on any modern browser. Phone is where most people spend time." },
          { q: "Can kids use BesideU?", a: "Kids 13+ can have their own account. Younger children can be added as cared-for profiles by a parent." },
          { q: "How do I contact support?", a: "Use the Feedback button in the app, or email support from your Account page." },
          { q: "How do I delete everything?", a: "From Account → Data → Delete account. See the Account page for details." },
        ]}
      />
    </>
  );
}
