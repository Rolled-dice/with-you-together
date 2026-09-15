import { createFileRoute } from "@tanstack/react-router";
import { DocsShell } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "SomeoneNear Docs | Guides & how-tos" },
      { name: "description", content: "Learn how to use SomeoneNear: Companion, Listeners, Family Circle, billing, and more." },
      { property: "og:title", content: "SomeoneNear Docs" },
      { property: "og:description", content: "Guides for every part of SomeoneNear, for you and your family." },
    ],
  }),
  component: DocsShell,
});
