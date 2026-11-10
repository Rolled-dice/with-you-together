import { createFileRoute } from "@tanstack/react-router";
import { getLaunchMarket } from "@/lib/launch-market.functions";
import { PrototypeLanding } from "@/components/prototype/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Warm Family Presence | SomeoneNear" },
      {
        name: "description",
        content:
          "A warm place for your family circle, everyday reminders, private reflection and messages for the moments that matter.",
      },
      { property: "og:title", content: "Warm Family Presence | SomeoneNear" },
      { property: "og:description", content: "Stay close to the people and moments that matter." },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { property: "og:url", content: "https://someonenear.com/" },
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
