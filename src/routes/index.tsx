import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/landing/brand-mark";
import { EditorialAvatar } from "@/components/identity/editorial-avatar";
import {
  ChatCircleIcon,
  UsersIcon,
  CalendarHeartIcon,
  PillIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SomeoneNear — A little closer, every day" },
      {
        name: "description",
        content:
          "A warm place for your family circle, everyday reminders, private reflection and messages for the moments that matter.",
      },
      { property: "og:title", content: "SomeoneNear — A little closer, every day" },
      { property: "og:description", content: "Stay close to the people and moments that matter." },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { property: "og:url", content: "https://someonenear.com/" },
      { name: "twitter:image", content: "https://someonenear.com/logo.png" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/" }],
  }),
  component: Landing,
});
const features = [
  {
    icon: UsersIcon,
    title: "A circle that feels like home",
    text: "Invite family into your own circle. Keep control of what you share.",
    href: "/docs/family",
  },
  {
    icon: PillIcon,
    title: "The everyday, remembered",
    text: "Keep medications and personal reminders together in one calm place.",
    href: "/docs/medication",
  },
  {
    icon: ChatCircleIcon,
    title: "Space to be yourself",
    text: "Talk things through with your private AI Companion and reflect on how you feel.",
    href: "/docs/companion",
  },
  {
    icon: CalendarHeartIcon,
    title: "A message for later",
    text: "Schedule a note, voice recording or video for a moment that matters.",
    href: "/docs/send-later",
  },
] as const;
function Landing() {
  const [menu, setMenu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-card focus:p-4"
      >
        Skip to content
      </a>
      <div className="border-b border-border bg-surface px-4 py-2 text-center text-sm">
        A warm family presence. Wherever life takes you.
      </div>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-4 px-5">
          <Link to="/" aria-label="SomeoneNear home">
            <Wordmark />
          </Link>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border lg:hidden"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="landing-navigation"
            disabled={!hydrated}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <XIcon size={24} /> : <ListIcon size={24} />}
          </button>
          <nav
            id="landing-navigation"
            aria-label="Main navigation"
            className={`${menu ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-2 border-b border-border bg-background p-5 lg:static lg:flex lg:flex-row lg:items-center lg:gap-6 lg:border-0 lg:p-0`}
          >
            <a href="#for-families" onClick={() => setMenu(false)} className="py-3">
              For families
            </a>
            <a href="#included" onClick={() => setMenu(false)} className="py-3">
              What’s included
            </a>
            <a href="#how-it-works" onClick={() => setMenu(false)} className="py-3">
              How it works
            </a>
            <Link to="/docs" className="py-3">
              Docs
            </Link>
            <Link to="/auth" className="py-3">
              Log in
            </Link>
            <Link
              to="/auth"
              className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content">
        <section
          id="for-families"
          className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24"
        >
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-widest text-brand-accent">
              With you, together
            </p>
            <h1 className="max-w-xl font-serif text-5xl font-bold leading-[1.08] tracking-tight lg:text-7xl">
              Distance changes.
              <br />
              <span className="text-brand-accent italic">Closeness stays.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              A little space for your family, everyday care, and the words you want to share.
              SomeoneNear helps you make room for each other.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex min-h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground"
              >
                Find your space
              </Link>
              <a
                href="#included"
                className="inline-flex min-h-12 items-center rounded-full border border-primary px-7 font-semibold"
              >
                Take a look around
              </a>
            </div>
          </div>
          <figure className="relative mx-auto flex aspect-square w-full max-w-lg items-center justify-center overflow-hidden rounded-[3rem] border border-border bg-surface">
            <div
              className="absolute inset-10 rounded-full border border-dashed border-border"
              aria-hidden="true"
            />
            <div
              className="absolute inset-20 rounded-full border border-border"
              aria-hidden="true"
            />
            <div className="relative text-center">
              <span className="font-serif text-lg font-bold sm:text-3xl">
                Near, in every
                <br />
                little moment.
              </span>
              <p className="mt-4 hidden text-sm text-muted-foreground sm:block">
                Your people. Your pace.
              </p>
            </div>
            <div className="absolute left-[8%] top-[6%] scale-75 sm:scale-100">
              <EditorialAvatar
                size="lg"
                member={{
                  archetype: "aged-man",
                  skinTone: "#D99B7E",
                  avatarBg: "#EAB84B",
                  outfitColor: "#D95732",
                  backdropMotif: "leaves",
                }}
              />
            </div>
            <div className="absolute right-[6%] top-[10%] scale-75 sm:scale-100">
              <EditorialAvatar
                size="lg"
                member={{
                  archetype: "aged-woman",
                  skinTone: "#E5A98A",
                  avatarBg: "#F36D89",
                  outfitColor: "#102F50",
                  backdropMotif: "leaves",
                }}
              />
            </div>
            <div className="absolute bottom-[7%] left-[6%] scale-75 sm:scale-100">
              <EditorialAvatar
                size="lg"
                member={{
                  archetype: "adult-woman",
                  avatarBg: "#EAB84B",
                  outfitColor: "#8B1E3F",
                  backdropMotif: "waves",
                }}
              />
            </div>
            <div className="absolute bottom-[4%] right-[8%] scale-75 sm:scale-100">
              <EditorialAvatar
                size="lg"
                member={{
                  archetype: "child",
                  avatarBg: "#F36D89",
                  outfitColor: "#102F50",
                  backdropMotif: "leaves",
                }}
              />
            </div>
            <figcaption className="sr-only">
              An illustration of a family circle using SomeoneNear’s original avatars.
            </figcaption>
          </figure>
        </section>
        <section id="included" className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-accent">
            Little things. Lasting connection.
          </p>
          <h2 className="mt-3 font-serif text-4xl font-bold">Care that fits into your day.</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text, href }) => (
              <Link
                key={href}
                to={href}
                className="rounded-3xl border border-border bg-card p-6 transition-colors hover:bg-surface"
              >
                <Icon className="mb-6 h-8 w-8 text-brand-accent" aria-hidden="true" />
                <h3 className="font-serif text-2xl font-bold">{title}</h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">{text}</p>
                <span className="mt-6 inline-block font-semibold underline">Explore</span>
              </Link>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="font-serif text-4xl font-bold">Make yourself at home.</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              [
                "01",
                "Create your account",
                "A private space, with your preferences and your pace.",
              ],
              ["02", "Choose where to begin", "A conversation, a reminder or a message for later."],
              ["03", "Stay connected", "Return to your circle and see your latest in-app updates."],
            ].map(([n, title, text]) => (
              <li key={n} className="rounded-3xl border border-border p-6">
                <span className="font-serif text-3xl text-brand-accent">{n}</span>
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="border-t border-border bg-surface px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
          <Wordmark />
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link to="/docs">Help & docs</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
          <p className="text-sm text-muted-foreground">SomeoneNear · With you together</p>
        </div>
      </footer>
    </div>
  );
}
