import { createFileRoute } from "@tanstack/react-router";
import { DocsShell } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "SomeoneNear Docs | Guides & how-tos" },
      {
        name: "description",
        content:
          "Learn how to use SomeoneNear: Companion, reminders, Family Circle, billing, and more.",
      },
      { property: "og:title", content: "SomeoneNear Docs | Guides & how-tos" },
      {
        property: "og:description",
        content: "Guides for every part of SomeoneNear, for you and your family.",
      },
      { property: "og:url", content: "https://someonenear.com/docs" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/docs" }],
  }),
  component: DocsShell,
});
