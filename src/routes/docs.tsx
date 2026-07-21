import { createFileRoute } from "@tanstack/react-router";
import { DocsShell } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "WithU Docs — Guides & how-tos" },
      { name: "description", content: "Learn how to use WithU: Companion, Journal, Listeners, Family Circle, billing, and more." },
      { property: "og:title", content: "WithU Docs" },
      { property: "og:description", content: "Guides for every part of WithU — for you and your family." },
    ],
  }),
  component: DocsShell,
});
