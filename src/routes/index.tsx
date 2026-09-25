import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";

import {
  ArrowRightIcon,
  CaretRightIcon,
  ChatCircleTextIcon,
  CheckIcon,
  EnvelopeSimpleIcon,
  HeadphonesIcon,
  PhoneCallIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { JsonLd } from "@/components/json-ld";
import { Wordmark } from "@/components/landing/brand-mark";
import { FeatureCarousel } from "@/components/landing/feature-carousel";
import { RotatingHeadline } from "@/components/landing/rotating-headline";
import { DashboardMockup, ListenerCallMockup } from "@/components/landing/hero-mockups";
import { Orb, OrbCloud, OrbSparkle, type OrbTone } from "@/components/landing/playroom-orb";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLandingMotion } from "@/hooks/use-landing-motion";
import { useLiveStats } from "@/hooks/use-live-stats";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_DISPLAY } from "@/lib/currency";
import { getPublicStats } from "@/lib/stats.functions";

const TITLE = "SomeoneNear — we call your parents, so you know they're okay";
const DESCRIPTION =
  "A trained listener phones your elderly parent on a schedule you set, on their ordinary phone. After every call you get a short update on how they're really doing.";

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://someonenear.com/#website",
      url: "https://someonenear.com/",
      name: "SomeoneNear",
      description:
        "Scheduled check-in calls for elderly parents, with a written update to the family after every call.",
      inLanguage: ["en", "hi"],
    },
    {
      "@type": "Organization",
      "@id": "https://someonenear.com/#organization",
      name: "SomeoneNear",
      url: "https://someonenear.com/",
      founder: { "@type": "Person", name: "Mohit Dutt" },
    },
  ],
};

export const Route = createFileRoute("/")({
  loader: () => getPublicStats(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://someonenear.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/" }],
  }),
  component: Landing,
  errorComponent: () => null,
  notFoundComponent: () => null,
});

/* -------------------------------------------------------------------------- *
 * Content
 * -------------------------------------------------------------------------- */

const HERO_PROOF = ["Trained, vetted listeners", "Nothing for them to install", "An update after every call"];

/** The worry, in the visitor's own words — not our feature names. */
const WORRIES: { label: string; answer: string; tone: OrbTone }[] = [
  {
    label: "They live far away",
    answer: "We call, so the distance feels smaller.",
    tone: "saffron",
  },
  {
    label: "They seem lonely",
    answer: "A warm conversation, on their own phone.",
    tone: "pink",
  },
  {
    label: "They forget medication",
    answer: "Gentle reminders, and every dose logged.",
    tone: "aqua",
  },
  {
    label: "I can't call every day",
    answer: "We keep the routine when life gets busy.",
    tone: "grass",
  },
  {
    label: "Nobody tells me how they are",
    answer: "A short update after every single call.",
    tone: "navy",
  },
  {
    label: "They won't use an app",
    answer: "They never have to. It's just a phone call.",
    tone: "terracotta",
  },
];

const STEPS = [
  {
    title: "You pick a schedule",
    body: "Daily, a few times a week, or only when you need it. Change it whenever.",
  },
  {
    title: "We make the call",
    body: "A trained listener rings their ordinary phone. No app, no login, no setup on their end.",
  },
  {
    title: "You get an update",
    body: "A short note on how they really are, waiting for you when you next look.",
  },
];

const VOICES = [
  {
    quote:
      "I used to ring at 9pm out of guilt and get 'I'm fine' every time. Now I actually know she's been out in the garden.",
    who: "Daughter, two time zones away",
    tone: "saffron" as OrbTone,
  },
  {
    quote: "Dad won't touch a smartphone. This was the only thing that didn't ask him to learn anything.",
    who: "Son, primary carer",
    tone: "aqua" as OrbTone,
  },
  {
    quote:
      "The update after each call is the part I didn't expect to need. It's three lines and it settles my whole evening.",
    who: "Daughter, sharing care with her brother",
    tone: "pink" as OrbTone,
  },
];

const TRUST = [
  {
    icon: HeadphonesIcon,
    title: "Vetted and trained",
    body: "Every listener is trained before their first call. Nobody unqualified picks up the phone.",
  },
  {
    icon: PhoneCallIcon,
    title: "Just a phone call",
    body: "Audio only. It rings like any normal call — no camera, no app, no link to click.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Private by design",
    body: "Conversations belong to them. The family sees only what they choose to share.",
  },
];

/**
 * Pricing is read from the plan catalogue rather than retyped here, so the
 * marketing page can never drift from what billing actually charges.
 */
const PLANS = (["care", "care_plus"] as const).map((id) => {
  const plan = PLAN_DISPLAY[id];
  return {
    name: plan.name,
    price: plan.usdLabel,
    note: plan.note,
    highlight: plan.highlight ?? false,
    features: plan.bullets,
  };
});

const FAQS = [
  {
    q: "Does my parent need a smartphone or an app?",
    a: "No. We ring whatever phone they already use — a landline is completely fine. There is nothing to download, nothing to log into, and nothing for them to learn.",
  },
  {
    q: "Who actually makes the call?",
    a: "A trained SomeoneNear listener. They're vetted and trained before taking their first call, and they know how to ask the everyday questions that tell you how someone is really doing.",
  },
  {
    q: "What if they don't want to talk that day?",
    a: "Then they don't. A listener will never push. A two-minute call that ends early still tells us something, and we'll note it honestly rather than dress it up.",
  },
  {
    q: "How soon can a call happen?",
    a: "Check-in calls are booked at least two hours ahead so a real, prepared person is ready. On Care Plus you can also ask for an on-demand call when a day turns hard.",
  },
  {
    q: "Is this therapy or crisis support?",
    a: "No. This is company and awareness, not clinical treatment. If anyone is in danger we show local emergency numbers first, every time.",
  },
  {
    q: "What does the family get to see?",
    a: "A short update after each call: how they sounded, whether they ate, drank water and took medication, plus any notes worth passing on. Never a transcript.",
  },
];

/* -------------------------------------------------------------------------- *
 * Small building blocks
 * -------------------------------------------------------------------------- */

/** The near-black pill used inside cards and plates. */
function InkButton({ to, children }: { to: "/dashboard" | "/auth"; children: React.ReactNode }) {
  return (
    <Button
      asChild
      size="lg"
      data-magnetic
      className="rounded-full bg-ink px-7 text-base font-bold text-background hover:bg-ink/90"
    >
      <Link to={to}>{children}</Link>
    </Button>
  );
}

/* -------------------------------------------------------------------------- *
 * Page
 * -------------------------------------------------------------------------- */

function Landing() {
  const stats = useLiveStats(Route.useLoaderData());
  const [signedIn, setSignedIn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useLandingMotion(rootRef);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSignedIn(Boolean(session));
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const nextStep: "/dashboard" | "/auth" = signedIn ? "/dashboard" : "/auth";

  return (
    <div ref={rootRef} className="min-h-screen bg-background text-foreground">
      <JsonLd data={SCHEMA} />

      {/* Announcement ---------------------------------------------------- */}
      <div className="bg-primary px-4 py-2.5 text-center text-sm text-primary-foreground">
        Medication reminders now land straight on their phone.{" "}
        <Link to="/docs" className="font-semibold underline underline-offset-2">
          See how
        </Link>
      </div>

      {/* Nav ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        {/* 72px so the 40px mark has room to breathe rather than filling the bar */}
        <nav className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between gap-6 px-6">
          <Link to="/" aria-label="SomeoneNear home">
            <Wordmark />
          </Link>

          <div className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground lg:flex">
            <a href="#worries" className="transition-colors hover:text-foreground">
              For families
            </a>
            <a href="#included" className="transition-colors hover:text-foreground">
              What's included
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Plans
            </a>
            <Link to="/docs" className="transition-colors hover:text-foreground">
              Docs
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Signed in, the ghost link and the button both pointed at the app,
                so the nav showed "Open app" twice. Signed in needs only the one
                button; the "Log in" link is only meaningful when signed out. */}
            {!signedIn && (
              <Button asChild variant="ghost" className="hidden rounded-full font-semibold sm:inline-flex">
                <Link to={nextStep}>Log in</Link>
              </Button>
            )}
            <Button asChild data-magnetic className="rounded-full px-5 font-bold">
              <Link to={nextStep}>{signedIn ? "Open app" : "Try for free"}</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero -------------------------------------------------------- */}
        <section className="relative overflow-hidden px-6 pb-16 pt-14 sm:pt-20">
          {/* Background orbs. Scenery, so they stay faceless and far back. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            {/* These two watch the cursor. Scenery that notices you is on-theme
                for a product about being checked in on. */}
            <div data-drift className="absolute left-[6%] top-[14%] opacity-70">
              <Orb tone="saffron" face="plain" gaze className="h-16 w-16" />
            </div>
            <div data-drift className="absolute right-[8%] top-[9%] opacity-70">
              <Orb tone="periwinkle" face="plain" gaze className="h-11 w-11" />
            </div>
            <div data-drift className="absolute left-[14%] top-[46%]">
              <OrbSparkle className="h-5 w-5 text-orb-terracotta" />
            </div>
            <div data-drift className="absolute right-[16%] top-[38%]">
              <OrbSparkle className="h-4 w-4 text-orb-pink" />
            </div>
          </div>

          <div className="mx-auto w-full max-w-4xl text-center">
            <h1 className="mx-auto max-w-3xl text-[2.6rem] leading-[1.08] sm:text-6xl lg:text-[4.2rem]">
              <RotatingHeadline />
            </h1>

            <p
              data-hero-proof
              className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-muted-foreground"
            >
              {HERO_PROOF.map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckIcon className="h-3.5 w-3.5 text-orb-grass" weight="bold" />
                  {item}
                </span>
              ))}
            </p>
          </div>

          {/* Dual paths — the two people who arrive on this page */}
          <div className="mx-auto mt-10 grid w-full max-w-5xl gap-4 md:grid-cols-2">
            <article data-hero-card className="rounded-[28px] bg-surface px-6 py-9 text-center sm:px-9">
              <h2 className="mx-auto max-w-xs text-2xl">Check-in calls for a parent or loved one</h2>
              <div className="mt-5">
                <InkButton to={nextStep}>Start a Care plan</InkButton>
              </div>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CheckIcon className="h-3 w-3" weight="bold" />
                No card needed
              </p>
              <div className="mt-6">
                <DashboardMockup />
              </div>
            </article>

            <article data-hero-card className="rounded-[28px] bg-surface px-6 py-9 text-center sm:px-9">
              <h2 className="mx-auto max-w-xs text-2xl">A real listener to talk to, whenever you need one</h2>
              <div className="mt-5">
                <InkButton to={nextStep}>Book a listener call</InkButton>
              </div>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CheckIcon className="h-3 w-3" weight="bold" />
                Private by default
              </p>
              <div className="mt-6">
                <ListenerCallMockup />
              </div>
            </article>
          </div>
        </section>

        {/* Worries ----------------------------------------------------- */}
        <section id="worries" className="scroll-mt-20 px-6 py-16">
          <h2 data-reveal className="text-center text-2xl sm:text-3xl">
            What are you worried about?
          </h2>

          <ul className="mx-auto mt-8 grid w-full max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORRIES.map((w) => (
              <li key={w.label} data-reveal-stagger>
                <Link
                  to={nextStep}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40"
                >
                  <Orb tone={w.tone} face="calm" gaze className="h-8 w-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{w.label}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{w.answer}</span>
                  </span>
                  <CaretRightIcon
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                    weight="bold"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Features, as an auto-advancing carousel ------------------- */}
        <FeatureCarousel />

        {/* Marquee ---------------------------------------------------- */}
        <div aria-hidden="true" className="mt-10 overflow-hidden border-y border-ink/10 bg-plate-saffron py-3.5">
          <div data-marquee-track className="flex w-max items-center gap-8 whitespace-nowrap">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="flex items-center gap-8 text-sm font-extrabold uppercase tracking-wide text-ink">
                Checking in when they can&apos;t
                <Orb tone={i % 2 === 0 ? "terracotta" : "navy"} face="calm" className="h-5 w-5" />
              </span>
            ))}
          </div>
        </div>

        {/* How it works ---------------------------------------------- */}
        <section id="how-it-works" className="scroll-mt-20 px-6 py-16">
          <div data-reveal className="text-center">
            <h2 className="text-2xl sm:text-3xl">Three steps, then we handle it</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Setting it up takes a few minutes. After that it just happens.
            </p>
          </div>

          {/* Genuinely a sequence, so the numbers are earning their place. */}
          <ol className="mx-auto mt-10 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} data-reveal-stagger className="rounded-2xl border border-border bg-card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-background">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Voices ---------------------------------------------------- */}
        <section className="relative overflow-hidden px-6 py-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 -z-10 mx-auto max-w-4xl">
            <div data-drift className="absolute left-[10%] top-0">
              <Orb tone="periwinkle" face="calm" className="h-12 w-12" />
            </div>
            <div data-drift className="absolute right-[12%] top-2">
              <Orb tone="grass" face="wink" className="h-14 w-14" />
            </div>
            <div data-drift className="absolute left-[28%] top-16">
              <Orb tone="saffron" face="smile" className="h-9 w-9" />
            </div>
          </div>

          <h2 data-reveal className="mx-auto max-w-lg text-center text-2xl sm:text-3xl">
            The part families didn&apos;t expect to need
          </h2>

          <div className="mx-auto mt-10 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
            {VOICES.map((v) => (
              <figure
                key={v.who}
                data-reveal-stagger
                className="flex h-full flex-col justify-between rounded-2xl bg-surface p-6"
              >
                <blockquote className="text-[0.95rem] leading-relaxed">&ldquo;{v.quote}&rdquo;</blockquote>
                <figcaption className="mt-5 flex items-center gap-2.5 text-xs font-semibold text-muted-foreground">
                  <Orb tone={v.tone} face="calm" className="h-7 w-7 shrink-0" />
                  {v.who}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Trust ----------------------------------------------------- */}
        <section className="px-6 py-10">
          <div
            data-reveal
            className="mx-auto w-full max-w-6xl rounded-[32px] bg-plate-navy px-7 py-12 text-background sm:px-12"
          >
            <h2 className="mx-auto max-w-lg text-center text-2xl sm:text-3xl">A trained human, not a robocall</h2>

            <div className="mt-9 grid gap-8 sm:grid-cols-3">
              {TRUST.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-background/15">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed opacity-80">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats ----------------------------------------------------- */}
        <section className="px-6 py-10">
          <div
            data-reveal
            className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[32px] bg-plate-periwinkle px-7 py-14 text-center text-background sm:px-12"
          >
            <OrbCloud className="pointer-events-none absolute -left-8 bottom-0 h-24 w-48 text-background/25" />
            <OrbCloud className="pointer-events-none absolute -right-6 top-4 h-16 w-32 text-background/20" />

            <h2 className="mx-auto max-w-lg text-2xl sm:text-3xl">Families are sleeping a little easier</h2>

            <dl className="mt-10 grid gap-8 sm:grid-cols-3">
              {[
                { label: "People here", value: stats.members },
                { label: "Listener calls held", value: stats.sessions },
                { label: "Check-ins shared", value: stats.checkins },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span data-counter={s.value} className="block text-4xl font-extrabold tabular-nums tracking-tight">
                      {s.value.toLocaleString()}
                    </span>
                    <span className="mt-1 block text-sm font-semibold opacity-80">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Pricing --------------------------------------------------- */}
        <section id="pricing" className="scroll-mt-20 px-6 py-16">
          <div data-reveal className="text-center">
            <h2 className="text-2xl sm:text-3xl">Simple, flexible pricing</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Change or leave any month. No contracts, no exit fees.
            </p>
          </div>

          <div className="mx-auto mt-10 grid w-full max-w-4xl gap-4 md:grid-cols-2">
            {PLANS.map((p) => (
              <article
                key={p.name}
                data-reveal-stagger
                className={`relative rounded-[28px] border p-7 ${
                  p.highlight ? "border-primary/50 bg-surface" : "border-border bg-card"
                }`}
              >
                {p.highlight ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground">
                    Most chosen
                  </span>
                ) : null}

                <h3 className="text-xl">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.note}</p>
                <p className="mt-5 text-4xl font-extrabold tracking-tight">
                  {p.price}
                  <span className="text-base font-semibold text-muted-foreground"> / month</span>
                </p>

                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-orb-grass" weight="bold" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <InkButton to={nextStep}>Choose {p.name}</InkButton>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ ------------------------------------------------------- */}
        <section id="faq" className="scroll-mt-20 px-6 py-16">
          <h2 data-reveal className="text-center text-2xl sm:text-3xl">
            Questions families quietly ask
          </h2>

          <div data-reveal className="mx-auto mt-8 w-full max-w-2xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q} className="border-border">
                  <AccordionTrigger className="text-left text-base font-bold">{f.q}</AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Closing scene --------------------------------------------- */}
        <section className="relative overflow-hidden bg-plate-saffron px-6 pb-0 pt-20 text-center">
          <h2 className="relative z-10 mx-auto max-w-xl text-3xl text-ink sm:text-4xl">
            You can&apos;t always be there.
            <br />
            But someone can.
          </h2>

          <div className="relative z-10 mt-7">
            <Button asChild size="lg" data-magnetic className="rounded-full px-9 text-base font-bold">
              <Link to={nextStep}>
                {signedIn ? "Open SomeoneNear" : "Start with one call"}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs font-semibold text-ink/70">No card needed · Cancel any time</p>
          </div>

          {/* A rainbow arc, drawn as stacked semicircles from the orb family */}
          <div aria-hidden="true" className="pointer-events-none relative mx-auto mt-12 h-40 w-[620px] max-w-full">
            {[
              { tone: "bg-orb-pink", inset: 0 },
              { tone: "bg-orb-periwinkle", inset: 26 },
              { tone: "bg-orb-grass", inset: 52 },
            ].map((arc) => (
              <div
                key={arc.tone}
                className={`absolute bottom-0 rounded-t-full ${arc.tone}`}
                style={{
                  left: arc.inset,
                  right: arc.inset,
                  top: arc.inset,
                }}
              />
            ))}
            <OrbCloud className="absolute -left-4 bottom-0 h-20 w-40 text-background" />
            <OrbCloud className="absolute -right-2 bottom-0 h-14 w-28 text-background" />
          </div>
        </section>
      </main>

      {/* Footer ------------------------------------------------------ */}
      <footer className="bg-plate-cream px-6 py-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Wordmark />
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">Checking in when they can&apos;t.</p>
            </div>

            <div className="flex flex-wrap gap-x-12 gap-y-6 text-sm">
              <nav aria-label="Product">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Product</h2>
                <ul className="mt-3 space-y-2">
                  <li>
                    <a href="#how-it-works" className="hover:text-primary">
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="hover:text-primary">
                      Plans
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-primary">
                      FAQ
                    </a>
                  </li>
                </ul>
              </nav>

              <nav aria-label="Company">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Company</h2>
                <ul className="mt-3 space-y-2">
                  <li>
                    <Link to="/docs" className="hover:text-primary">
                      Docs
                    </Link>
                  </li>
                  <li>
                    <Link to="/docs/check-in" className="hover:text-primary">
                      Check-ins
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SomeoneNear</p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="mailto:care@someonenear.com" className="inline-flex items-center gap-2 hover:text-primary">
                <EnvelopeSimpleIcon className="h-4 w-4" />
                care@someonenear.com
              </a>
              <FeedbackDialog
                trigger={
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <ChatCircleTextIcon className="mr-2 h-4 w-4" />
                    Send feedback
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
