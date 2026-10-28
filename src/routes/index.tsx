import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";

import {
  ArrowRightIcon,
  BookOpenTextIcon,
  CaretRightIcon,
  ChatCircleTextIcon,
  CheckIcon,
  EnvelopeSimpleIcon,
  FlowerLotusIcon,
  HeadphonesIcon,
  HeartbeatIcon,
  LifebuoyIcon,
  PhoneCallIcon,
  PillIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersIcon,
} from "@phosphor-icons/react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { JsonLd } from "@/components/json-ld";
import { Wordmark } from "@/components/landing/brand-mark";
import { CalmBand } from "@/components/landing/calm-invite";
import { FeatureCarousel } from "@/components/landing/feature-carousel";
import { CareHero } from "@/components/care-ui/care-hero";
import { ThemeToggle } from "@/components/app-theme";
import { QuickCareActions } from "@/components/care-ui/quick-care-actions";
import { Orb, OrbCloud, OrbSparkle, type OrbTone } from "@/components/landing/playroom-orb";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLandingMotion } from "@/hooks/use-landing-motion";
import { useLiveStats } from "@/hooks/use-live-stats";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_DISPLAY } from "@/lib/currency";
import { getPublicStats } from "@/lib/stats.functions";

const TITLE = "Someone to Talk To | On-Demand Check-Ins | SomeoneNear";
const DESCRIPTION =
  "Talk when you want. Get a friendly check-in when you need one. SomeoneNear connects you with real, compassionate listeners when you just need someone around.";

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
  ssr: false,
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

const MARQUEE_LINES = [
  "Checking in when they can’t.",
  "Talk when you want. Get a check-in when you need one.",
  "You can’t always be there. But what if someone could?",
  "Being independent doesn’t mean you never need someone.",
  "There are days when you want to talk, but don’t know who to call.",
  "Care doesn’t have to feel clinical.",
  "A 15-minute call that changes the whole afternoon.",
  "Not an alert button. Just someone to talk to.",
];

const HERO_PROOF = [
  "Trained, vetted listeners",
  "Nothing for them to install",
  "An update after every call",
];

const WORRIES: { label: string; answer: string; tone: OrbTone }[] = [
  {
    label: "Living alone",
    answer: "A friendly call every day or two, so days don't drift into quiet weeks.",
    tone: "navy",
  },
  {
    label: "Missing doses",
    answer: "Gentle reminder calls at pill time. Not a cold phone alarm. A human voice.",
    tone: "terracotta",
  },
  {
    label: "Nobody to talk to",
    answer: "Real listeners who remember what you told them last week and ask how it went.",
    tone: "saffron",
  },
  {
    label: "Checking in without hovering",
    answer: "A short note after each call: what they talked about, how they sounded.",
    tone: "grass",
  },
  {
    label: "Not knowing if they're okay",
    answer: "If three calls go unanswered, we reach out to you immediately.",
    tone: "periwinkle",
  },
  {
    label: "They won't want fuss",
    answer: "To them, it's just a phone call. No passwords, no apps to update, no screen.",
    tone: "pink",
  },
];

const STEPS = [
  {
    title: "Pick the routine",
    body: "Tell us who to call, what time of day suits them, and what they love talking about.",
  },
  {
    title: "We make the call",
    body: "A vetted listener rings their ordinary phone. Fifteen unhurried minutes of real company.",
  },
  {
    title: "You get the update",
    body: "A short note in your inbox or WhatsApp: how they seemed, anything they needed, nothing clinical.",
  },
];

const VOICES = [
  {
    quote: "My mum calls her listener 'that nice girl from Delhi.' She puts a comb through her hair before the call. That's how I know it matters.",
    author: "Priya S.",
    role: "lives in London · mum in Pune",
    tone: "navy" as OrbTone,
  },
  {
    quote: "I didn't think he'd take to it. Now if the phone rings at four, he's waiting by the armchair. It's the only call he doesn't rush off.",
    author: "Rahul M.",
    role: "lives in Bengaluru · dad in Indore",
    tone: "terracotta" as OrbTone,
  },
  {
    quote: "It's the note afterwards that lets me sleep. Just 'she sounded bright today, talking about the monsoon.' That's all I need.",
    author: "Anita D.",
    role: "lives in Dubai · parents in Jaipur",
    tone: "grass" as OrbTone,
  },
];

const TRUST = [
  {
    title: "Every listener is background-checked and trained",
    body: "We verify identity, run background screening, and train each listener in conversational care, boundary-setting, and spotting distress.",
  },
  {
    title: "We never sell your data or record calls for ads",
    body: "Your parent's privacy is protected. Calls are confidential, notes are encrypted, and your family's information stays only with you.",
  },
  {
    title: "Cancel any time with one click",
    body: "No lock-in contracts, no awkward phone calls to cancel. Pause or stop whenever you want from your dashboard.",
  },
];

const FAQS = [
  {
    q: "Does my parent need a smartphone or an app?",
    a: "No. Calls go to whatever phone they already use — landline, basic mobile, or smartphone. They just pick up when it rings.",
  },
  {
    q: "Who are the listeners?",
    a: "Empathetic, mature adults who pass identity checks, background screening, and conversational training. Many are former counsellors, teachers, or experienced caregivers.",
  },
  {
    q: "What if my parent doesn't answer?",
    a: "We try again twenty minutes later. If they still don't answer, we try once more, then alert you by WhatsApp or SMS with the time and details.",
  },
  {
    q: "Can I choose what language they speak?",
    a: "Yes. We currently offer calls in English, Hindi, and Hinglish. We match your loved one with a listener fluent in their preferred language.",
  },
  {
    q: "Is this therapy or medical care?",
    a: "No. SomeoneNear is for social connection, companionship, and daily peace of mind. We don't diagnose, prescribe, or provide medical treatment.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. Every plan starts with a 7-day free trial. If it's not right for your family, cancel before the trial ends and you won't be charged a rupee.",
  },
];

const GET_STARTED_STEPS = [
  {
    step: "01",
    title: "Create your account",
    desc: "Sign up in 30 seconds with email or Google. No credit card required for the 7-day trial.",
    link: "/auth",
    linkText: "Get started",
    icon: SparkleIcon,
  },
  {
    step: "02",
    title: "Set up your Family Circle",
    desc: "Invite loved ones, set up the 3D globe, and customize sharing permissions for complete comfort.",
    link: "/family",
    linkText: "Explore Family Circle",
    icon: UsersIcon,
  },
  {
    step: "03",
    title: "Schedule check-ins & talk to Companion",
    desc: "Book a friendly human listener or try our private, voice-enabled AI Companion available 24/7.",
    link: "/listeners",
    linkText: "Book a check-in",
    icon: HeadphonesIcon,
  },
  {
    step: "04",
    title: "Gentle reminders & Calm space",
    desc: "Set medication alarms that call their phone, and unwind anytime with Chatak-Patak sound bubbles.",
    link: "/calm",
    linkText: "Visit Calm space",
    icon: FlowerLotusIcon,
  },
];

function AnnouncementBar() {
  const messages = [
    {
      key: "meds",
      node: (
        <>
          Medication reminders now land straight on their phone.{" "}
          <Link to="/docs/medication" className="font-semibold underline underline-offset-2">
            See how
          </Link>
        </>
      ),
    },
    {
      key: "calm",
      node: (
        <>
          Feeling stressed right now? Take a free calming minute.{" "}
          <Link to="/calm" className="font-semibold underline underline-offset-2">
            Start here
          </Link>
        </>
      ),
    },
    {
      key: "docs",
      node: (
        <>
          New to SomeoneNear? Read our 5-minute setup guide.{" "}
          <Link to="/docs/getting-started" className="font-semibold underline underline-offset-2">
            Read docs
          </Link>
        </>
      ),
    },
  ];

  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % messages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div
      role="region"
      aria-label="Announcements"
      className="relative z-40 border-b border-border bg-surface px-4 py-2 text-center text-xs text-foreground sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-2">
        <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-brand-primary" weight="fill" />
        <span aria-live="polite" className="transition-opacity duration-300">
          {messages[active].node}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Page
 * -------------------------------------------------------------------------- */

function Landing() {
  const loaderData = Route.useLoaderData();
  const stats = useLiveStats(loaderData || {
    members: 0,
    families: 0,
    checkins: 0,
    sessions: 0,
    active_listeners: 0,
    avg_rating: null,
    rating_count: 0,
  });
  const [signedIn, setSignedIn] = useState(false);
  const [currency, setCurrency] = useState<"usd" | "inr">("usd");
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

  const plans = (["care", "care_plus"] as const).map((id) => {
    const plan = PLAN_DISPLAY[id];
    const priceText = currency === "usd" ? plan.usdLabel : plan.inrLabel;

    return {
      id,
      name: plan.name,
      price: priceText,
      note: plan.note,
      features: plan.bullets,
      highlight: Boolean(plan.highlight),
    };
  });

  return (
    <div ref={rootRef} className="min-h-screen bg-background text-foreground">
      <JsonLd data={SCHEMA} />

      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Main Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <nav className="care-header-nav mx-auto flex min-h-[4.5rem] w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="SomeoneNear home">
            <Wordmark className="care-wordmark" />
          </Link>

          {/* Navigation Links */}
          <div className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground lg:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <Link to="/family" className="transition-colors hover:text-foreground">
              Family circle
            </Link>
            <Link to="/listeners" className="transition-colors hover:text-foreground">
              Listeners
            </Link>
            <Link to="/companion" className="transition-colors hover:text-foreground">
              Companion
            </Link>
            <Link
              to="/calm"
              className="inline-flex items-center gap-1.5 rounded-full bg-orb-periwinkle/15 px-3 py-1.5 text-brand-primary transition-colors hover:bg-orb-periwinkle/25"
            >
              <FlowerLotusIcon className="h-3.5 w-3.5" weight="fill" />
              Calm space
            </Link>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Plans
            </a>
            <Link
              to="/docs/getting-started"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-accent transition-colors hover:bg-surface"
            >
              <BookOpenTextIcon className="h-4 w-4" />
              Docs
            </Link>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <QuickCareActions inline />

            {!signedIn ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden rounded-full font-semibold sm:inline-flex"
                >
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button
                  asChild
                  data-magnetic
                  className="rounded-full px-5 font-bold"
                >
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            ) : (
              <Button
                asChild
                data-magnetic
                className="rounded-full px-5 font-bold"
              >
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* Care Hero (Interactive Family Globe + Actions) */}
        <CareHero signedIn={signedIn} />

        {/* Calm Band */}
        <CalmBand />

        {/* GET STARTED DOCS SHOWCASE SECTION */}
        <section id="get-started" className="scroll-mt-20 border-y border-border bg-surface/50 px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div data-reveal className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                <BookOpenTextIcon className="h-4 w-4" />
                Getting Started Guide
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
                Set up SomeoneNear in under 5 minutes
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-base text-muted-foreground">
                Everything you need to go from your first sign-in to an unhurried check-in call with your loved one.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {GET_STARTED_STEPS.map((s) => (
                <article
                  key={s.step}
                  data-reveal-stagger
                  className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <s.icon className="h-5 w-5" weight="bold" />
                      </span>
                      <span className="text-xs font-black tracking-widest text-muted-foreground/60">
                        {s.step}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold leading-snug">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.desc}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border/50">
                    <Link
                      to={s.link}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline"
                    >
                      {s.linkText}
                      <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-4 text-center">
              <Button asChild size="lg" className="rounded-full px-7 font-bold">
                <Link to="/docs/getting-started">
                  Read complete setup guide
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-7 font-semibold">
                <Link to="/docs">
                  Browse all docs & topics
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Worries Section */}
        <section id="worries" className="scroll-mt-20 px-6 py-16">
          <h2 data-reveal className="text-center text-2xl sm:text-3xl font-bold">
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
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                      {w.answer}
                    </span>
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

        {/* Features Carousel */}
        <FeatureCarousel />

        {/* Marquee Ticker */}
        <div
          aria-hidden="true"
          data-marquee-pause
          className="relative mt-10 overflow-hidden border-y border-ink/10 bg-plate-saffron py-3.5"
        >
          <div
            data-marquee-shine
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 opacity-60 mix-blend-overlay"
            style={{
              backgroundImage:
                "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.9) 45%, rgba(255,255,255,0.9) 55%, transparent 70%)",
              backgroundSize: "60% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "-60% 0",
            }}
          />
          <div data-marquee-track className="flex w-max items-center gap-8 whitespace-nowrap">
            {[...MARQUEE_LINES, ...MARQUEE_LINES].map((line, i) => (
              <span
                key={i}
                className="flex items-center gap-3 text-sm font-extrabold uppercase tracking-wide text-ink"
              >
                {line}
                <span data-marquee-icon className="inline-flex">
                  <Orb
                    tone={i % 3 === 0 ? "terracotta" : i % 3 === 1 ? "navy" : "periwinkle"}
                    face="calm"
                    className="h-5 w-5"
                  />
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <section id="how-it-works" className="scroll-mt-20 px-6 py-16">
          <div data-reveal className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold">Three steps, then we handle it</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Setting it up takes a few minutes. After that it just happens.
            </p>
          </div>

          <ol className="mx-auto mt-10 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                data-reveal-stagger
                className="rounded-2xl border border-border bg-card p-6"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-on-plate">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Voices / Testimonials */}
        <section className="relative overflow-hidden px-6 py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-6 -z-10 mx-auto max-w-4xl"
          >
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

          <div data-reveal className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold">Words from people who care</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Families navigating miles, time zones, and the quiet hours in between.
            </p>
          </div>

          <div className="mx-auto mt-10 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
            {VOICES.map((v) => (
              <blockquote
                key={v.author}
                data-reveal-stagger
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-sm leading-relaxed italic text-foreground">&ldquo;{v.quote}&rdquo;</p>
                <footer className="mt-6 flex items-center gap-3">
                  <Orb tone={v.tone} face="smile" className="h-9 w-9 shrink-0" />
                  <div>
                    <cite className="not-italic font-bold text-sm block">{v.author}</cite>
                    <span className="text-xs text-muted-foreground">{v.role}</span>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* Trust Proof Points */}
        <section className="border-t border-border bg-surface px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div data-reveal className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold">Built for peace of mind</h2>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {TRUST.map((t) => (
                <div key={t.title} data-reveal-stagger className="rounded-2xl border border-border bg-card p-6">
                  <ShieldCheckIcon className="h-7 w-7 text-brand-primary" weight="bold" />
                  <h3 className="mt-3 text-base font-bold leading-snug">{t.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Plans & Pricing */}
        <section id="pricing" className="scroll-mt-20 px-6 py-16">
          <div data-reveal className="text-center">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              Simple pricing
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold">A plan for every family</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Change or cancel anytime. All plans start with a 7-day free trial.
            </p>

            {/* Currency toggle */}
            <div className="mt-6 inline-flex rounded-full border border-border bg-surface p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCurrency("usd")}
                className={`rounded-full px-4 py-1.5 transition-colors ${
                  currency === "usd"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("inr")}
                className={`rounded-full px-4 py-1.5 transition-colors ${
                  currency === "inr"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                INR (₹)
              </button>
            </div>
          </div>

          <div className="mx-auto mt-10 grid w-full max-w-4xl gap-6 md:grid-cols-2">
            {plans.map((p) => (
              <article
                key={p.name}
                data-reveal-stagger
                className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-shadow hover:shadow-lg ${
                  p.highlight ? "border-primary/60 bg-surface shadow-md" : "border-border bg-card"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-8 rounded-full bg-primary px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground shadow-sm">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-2xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.note}</p>
                  <p className="mt-5 text-4xl font-extrabold tracking-tight">
                    {p.price}
                    <span className="text-base font-semibold text-muted-foreground"> / month</span>
                  </p>

                  <ul className="mt-7 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckIcon
                          className="mt-1 h-4 w-4 shrink-0 text-orb-grass"
                          weight="bold"
                        />
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-border/60">
                  <Button asChild size="lg" className="w-full rounded-full font-bold">
                    <Link
                      to={signedIn ? "/settings" : "/auth"}
                      search={signedIn ? undefined : { redirect: "/settings" }}
                    >
                      Choose {p.name}
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="scroll-mt-20 px-6 py-16 border-t border-border bg-surface/30">
          <h2 data-reveal className="text-center text-2xl sm:text-3xl font-bold">
            Questions families quietly ask
          </h2>

          <div data-reveal className="mx-auto mt-8 w-full max-w-2xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q} className="border-border">
                  <AccordionTrigger className="text-left text-base font-bold">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden bg-plate-saffron px-6 pb-0 pt-20 text-center">
          <h2 className="relative z-10 mx-auto max-w-xl text-3xl font-bold text-ink sm:text-4xl">
            You can&apos;t always be there.
            <br />
            But someone can.
          </h2>

          <div className="relative z-10 mt-7">
            <Button
              asChild
              size="lg"
              data-magnetic
              className="rounded-full px-9 text-base font-bold"
            >
              <Link to={nextStep}>
                {signedIn ? "Open SomeoneNear" : "Start with one call"}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs font-semibold text-ink/70">
              No card needed · 7-day trial · Cancel anytime
            </p>
          </div>

          {/* Rainbow arc decoration */}
          <div
            aria-hidden="true"
            className="pointer-events-none relative mx-auto mt-12 h-40 w-[620px] max-w-full"
          >
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

      {/* COMPREHENSIVE FOOTER */}
      <footer className="border-t border-border bg-surface px-6 py-14">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <Link to="/">
                <Wordmark className="care-wordmark" />
              </Link>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Checking in when you can&apos;t. Friendly listener check-ins, connected family globe, and 24/7 AI companion support.
              </p>
              <div className="mt-5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <ShieldCheckIcon className="h-4 w-4" />
                  Verified & Privacy First
                </span>
              </div>
            </div>

            {/* Product navigation */}
            <nav aria-label="Product">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Product
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">
                    How it works
                  </a>
                </li>
                <li>
                  <Link to="/family" className="text-muted-foreground transition-colors hover:text-foreground">
                    Family Circle & Globe
                  </Link>
                </li>
                <li>
                  <Link to="/listeners" className="text-muted-foreground transition-colors hover:text-foreground">
                    Human Listeners
                  </Link>
                </li>
                <li>
                  <Link to="/companion" className="text-muted-foreground transition-colors hover:text-foreground">
                    AI Companion
                  </Link>
                </li>
                <li>
                  <Link to="/calm" className="text-muted-foreground transition-colors hover:text-foreground">
                    Calm Space & Arcade
                  </Link>
                </li>
                <li>
                  <Link to="/reminders" className="text-muted-foreground transition-colors hover:text-foreground">
                    Medication Reminders
                  </Link>
                </li>
                <li>
                  <a href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">
                    Plans & Pricing
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">
                    FAQ
                  </a>
                </li>
              </ul>
            </nav>

            {/* Docs & Guides */}
            <nav aria-label="Guides & Docs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Docs & Help
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/docs/getting-started" className="font-semibold text-primary transition-colors hover:underline">
                    Get Started Guide
                  </Link>
                </li>
                <li>
                  <Link to="/docs/check-in" className="text-muted-foreground transition-colors hover:text-foreground">
                    Check-in Calls
                  </Link>
                </li>
                <li>
                  <Link to="/docs/family" className="text-muted-foreground transition-colors hover:text-foreground">
                    Family Setup
                  </Link>
                </li>
                <li>
                  <Link to="/docs/companion" className="text-muted-foreground transition-colors hover:text-foreground">
                    Companion Voice
                  </Link>
                </li>
                <li>
                  <Link to="/docs/medication" className="text-muted-foreground transition-colors hover:text-foreground">
                    Medication Doses
                  </Link>
                </li>
                <li>
                  <Link to="/docs/safety" className="text-muted-foreground transition-colors hover:text-foreground">
                    Safety & Crisis Lines
                  </Link>
                </li>
                <li>
                  <Link to="/docs" className="text-muted-foreground transition-colors hover:text-foreground">
                    All Documentation
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Legal */}
            <nav aria-label="Legal">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Legal
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className="text-muted-foreground transition-colors hover:text-foreground">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <PrivacyChoicesButton className="h-auto p-0 text-sm font-normal text-muted-foreground hover:text-foreground" />
                </li>
              </ul>
            </nav>
          </div>

          {/* Crisis Hotline & Safety Disclaimer */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">
              <HeartbeatIcon className="mr-1.5 inline h-4 w-4 text-orb-terracotta" />
              Not an emergency service:
            </p>
            <p className="mt-1">
              SomeoneNear provides companionship, social connection, and routine care check-ins. We are not a medical provider or crisis helpline. If you or someone you care for is in immediate distress or danger, please contact local emergency services immediately: In the US, dial <strong>988</strong> (Suicide & Crisis Lifeline) or <strong>911</strong>. In India, call <strong>112</strong> (National Emergency) or <strong>1800-599-0019</strong> (Kiran Mental Health Helpline).
            </p>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SomeoneNear. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="mailto:care@someonenear.com"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <EnvelopeSimpleIcon className="h-4 w-4" />
                care@someonenear.com
              </a>
              <FeedbackDialog
                trigger={
                  <Button variant="ghost" size="sm" className="rounded-full text-xs">
                    <ChatCircleTextIcon className="mr-1.5 h-3.5 w-3.5" />
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
