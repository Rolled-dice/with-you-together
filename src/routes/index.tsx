import { createFileRoute } from "@tanstack/react-router";
import { getLaunchMarket } from "@/lib/launch-market.functions";
import { PrototypeLanding } from "@/components/prototype/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SomeoneNear — Warm Family Care, Reminders & AI Companion" },
      {
        name: "description",
        content:
          "Stay close across any distance. SomeoneNear provides gentle phone check-in listeners, daily medication reminders, mood insights, and an empathetic AI Companion for elderly family care.",
      },
      { property: "og:site_name", content: "SomeoneNear" },
      { property: "og:title", content: "SomeoneNear — Warm Family Care, Reminders & AI Companion" },
      {
        property: "og:description",
        content:
          "Stay close across any distance. SomeoneNear provides gentle phone check-in listeners, daily medication reminders, mood insights, and an empathetic AI Companion for elderly family care.",
      },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { property: "og:url", content: "https://someonenear.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SomeoneNear — Warm Family Care, Reminders & AI Companion" },
      {
        name: "twitter:description",
        content:
          "Stay close across any distance. SomeoneNear provides gentle phone check-in listeners, daily medication reminders, mood insights, and an empathetic AI Companion for elderly family care.",
      },
      { name: "twitter:image", content: "https://someonenear.com/logo.png" },
    ],
    links: [
      { rel: "canonical", href: "https://someonenear.com/" },
      { rel: "shortcut icon", href: "/favicon.ico?v=12" },
      { rel: "icon", href: "/favicon.ico?v=12", sizes: "any" },
      { rel: "icon", href: "/favicon.svg?v=12", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png?v=12", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon-64.png?v=12", sizes: "64x64", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=12", sizes: "180x180" },
    ],
  }),
  loader: () => getLaunchMarket(),
  component: Home,
});

function Home() {
  const { market } = Route.useLoaderData();
  return <PrototypeLanding market={market} />;
}
