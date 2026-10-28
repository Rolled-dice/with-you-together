import { createFileRoute } from "@tanstack/react-router";
import { FrontendPreview } from "@/components/frontend-preview/frontend-preview";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Someone to Talk To | On-Demand Check-Ins | SomeoneNear" },
      {
        name: "description",
        content:
          "Talk when you want. Get a friendly check-in when you need one. SomeoneNear connects you with real, compassionate listeners on an ordinary phone.",
      },
      { property: "og:title", content: "Someone to Talk To | On-Demand Check-Ins | SomeoneNear" },
      {
        property: "og:description",
        content:
          "Talk when you want. Get a friendly check-in when you need one. SomeoneNear connects your loved ones with real, compassionate listeners.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://someonenear.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FrontendPreview,
});
