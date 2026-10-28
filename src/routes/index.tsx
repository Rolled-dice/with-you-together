import { createFileRoute } from "@tanstack/react-router";
import { FrontendPreview } from "@/components/frontend-preview/frontend-preview";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SomeoneNear | New UI Preview" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FrontendPreview,
});
