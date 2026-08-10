import { createFileRoute } from "@tanstack/react-router";
import { DocsShell } from "@/components/docs/docs-shell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "BesideU Docs — Guides & how-tos" },
      { name: "description", content: "Learn how to use BesideU: Companion, Listeners, Family Circle, billing, and more." },
      { property: "og:title", content: "BesideU Docs" },
      { property: "og:description", content: "Guides for every part of BesideU — for you and your family." },
    ],
  }),
  component: DocsShell,
});
