import { createFileRoute } from "@tanstack/react-router";
import { DocHeader, DocSection } from "@/components/docs/docs-shell";
import { JsonLd } from "@/components/json-ld";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Are device notifications enabled?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Background push delivery is not available in this release. You can read your updates in the notification inbox while using the app.",
      },
    },
    {
      "@type": "Question",
      name: "Can I send a voice message?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Send Later supports scheduled voice messages for available family contacts. Recording requires browser microphone permission. Upload a supported recording if your browser cannot record.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use it on my phone?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Your main navigation sits at the bottom of the screen on mobile. On desktop, use the sidebar.",
      },
    },
    {
      "@type": "Question",
      name: "Does Companion replace professional help?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Companion is an AI feature for everyday reflection. Use the Safety page for grounding resources and independent support services when needed.",
      },
    },
  ],
};

export const Route = createFileRoute("/docs/faq")({
  head: () => ({
    meta: [
      { title: "Common Questions & FAQ | SomeoneNear Docs" },
      {
        name: "description",
        content:
          "Clear answers to common questions about SomeoneNear family care, AI companion support, phone listener calls, and messaging.",
      },
      { property: "og:title", content: "Common Questions & FAQ | SomeoneNear Docs" },
      {
        property: "og:description",
        content:
          "Clear answers to common questions about SomeoneNear family care, AI companion support, phone listener calls, and messaging.",
      },
      { property: "og:url", content: "https://someonenear.com/docs/faq" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/docs/faq" }],
  }),
  component: Page,
});
function Page() {
  return (
    <>
      <JsonLd data={faqSchema} />
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
