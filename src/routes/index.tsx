import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  HeartIcon,
  UsersIcon,
  ChartLineIcon,
  ShieldIcon,
  ShieldCheckIcon,
  PhoneCallIcon,
  BellRingingIcon,
  CalendarHeartIcon,
  CheckIcon,
  ArrowRightIcon,
  EnvelopeSimpleIcon,
  ChatCircleTextIcon,
  HeadphonesIcon,
} from "@phosphor-icons/react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { GentleNudge, NudgeDot } from "@/components/gentle-nudge";
import { QuietEmptyState } from "@/components/quiet-empty-state";
import { CallCardPreview } from "@/components/call-card-preview";
import { AiSnippetPreview } from "@/components/ai-snippet-preview";
import { TrustBadge } from "@/components/trust-badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { getPublicStats } from "@/lib/stats.functions";
import { useLiveStats } from "@/hooks/use-live-stats";

const TITLE = "SomeoneNear";
const DESCRIPTION =
  "SomeoneNear helps you find someone near for a caring check-in, a human listener, or quiet companionship whenever you need to feel heard.";

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

function formatCount(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k+`;
  }
  return String(n);
}

const features: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}[] = [
  {
    icon: HeartIcon,
    title: "Daily check-ins",
    body: "One small question a day. Answer in a word, or skip it. Nothing is scored.",
  },
  {
    icon: BellRingingIcon,
    title: "Gentle reminders",
    body: "Medicines, water, appointments, nudges that sound like a friend, not an alarm.",
  },
  {
    icon: UsersIcon,
    title: "Family circle",
    body: "Keep the people you trust close, and only share what you actually want to share.",
  },
  {
    icon: CalendarHeartIcon,
    title: "Send It Later",
    body: "Leave a message for a future day. Because you can't always be there, but something can.",
  },
];

const plans = [
  {
    name: "Care",
    price: "$49",
    note: "For one loved one you want to keep an eye on",
    features: [
      "18 Check-In calls a month",
      "15 minutes per call",
      "Family dashboard updates after every call",
      "Companion chat with a daily message allowance",
    ],
  },
  {
    name: "Care Plus",
    price: "$79",
    note: "For families sharing the care between them",
    highlight: true,
    features: [
      "30 Check-In calls a month",
      "15 minutes per call",
      "Unlimited Companion chat, no daily cap",
      "Shared circle, up to 5 people",
      "On-demand Check-Ins when a day feels hard",
    ],
  },
];

const faqs = [
  {
    q: "Do I have to explain what's wrong?",
    a: "No. “I'm fine” is sometimes just easier than explaining what's actually going on, so you can start with nothing at all. A listener will simply stay with you.",
  },
  {
    q: "Is anyone told about my conversations?",
    a: "No. Your companion chats and calls are private to you. Family members only ever see what you explicitly choose to share.",
  },
  {
    q: "How soon can I speak to a person?",
    a: "Listener calls are booked at least two hours ahead so a real, prepared human is ready for you. The companion is there in the meantime, always.",
  },
  {
    q: "Is this therapy or crisis support?",
    a: "No. SomeoneNear is company and care, not clinical treatment. If you're in danger, please reach out to your local emergency line, we'll always show you those numbers first.",
  },
];

function Landing() {
  const stats = useLiveStats(Route.useLoaderData());
  const [signedIn, setSignedIn] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!els.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const nextStep: "/dashboard" | "/auth" = signedIn ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-brand bg-primary text-primary-foreground">
            <HeartIcon className="h-4.5 w-4.5" weight="fill" />
          </span>
          <span className="font-sans text-lg font-semibold tracking-tight">SomeoneNear</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost">
            <Link to="/docs">Docs</Link>
          </Button>
          <Button asChild>
            <Link to={nextStep}>{signedIn ? "Open app" : "Start gently"}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-20 px-6 pb-28">
        {/* Hero */}
        <section data-reveal className="space-y-6 pt-8">
          <p className="inline-flex items-center gap-2.5 rounded-brand border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
            <NudgeDot />
            A quiet place to be heard
          </p>
          <h1 className="font-display text-4xl font-medium leading-[1.15] sm:text-5xl">
            Someone near, whenever you don't know who to call
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            SomeoneNear gives you a caring check-in, a real listener, and someone near in
            the moments when you don't want to be alone.
          </p>
          <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={nextStep}>
                {signedIn ? "Open SomeoneNear" : "Start your journey"}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
              <Link to="/docs">See how it works</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No pressure. No performance. Leave whenever you like.
          </p>
        </section>

        {/* Experience Preview */}
        <section data-reveal className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="font-display text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              What it feels like
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CallCardPreview />
            <AiSnippetPreview />
          </div>
        </section>

        {/* Quiet truth */}
        <section data-reveal className="space-y-6 text-center">
          <p className="font-display text-2xl leading-snug sm:text-[1.7rem]">
            “I'm fine” is sometimes just easier than explaining what's actually going on.
          </p>
          <p className="mx-auto max-w-md leading-relaxed text-muted-foreground">
            Some people aren't alone. They just don't have anyone available when they need
            them. Sometimes the hardest part isn't being alone, it's not knowing who to
            call.
          </p>
        </section>

        {/* Trust & credibility */}
        <section data-reveal className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-semibold">Who answers, and how it works</h2>
            <p className="mx-auto max-w-lg leading-relaxed text-muted-foreground">
              Before you book anything, here's exactly what happens and who's on the other end.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <HeadphonesIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-medium">Vetted listeners</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Every listener is trained before they take their first call. Nobody unqualified
                picks up the phone.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <PhoneCallIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-medium">Just a phone call</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Audio only. It rings like any normal call, no app to download, no camera, no link
                to click.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <ShieldCheckIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-medium">Private by design</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Conversations are yours. Family only ever sees what you choose to share, nothing
                more.
              </p>
            </div>
          </div>
        </section>

        {/* A gentle nudge, shown as itself */}
        <section data-reveal className="space-y-4">
          <h2 className="font-display text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            How we reach you
          </h2>
          <GentleNudge
            title="Just checking in, how are you feeling today?"
            body="Answer in a word. Or don't. Either is completely okay."
          />
          <GentleNudge
            title="Your evening tablet is due in 20 minutes"
            body="Reply TAKEN when you've had it. We'll stay quiet after that."
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            No red badges, no sirens. Just a warm pulse and a sentence you can ignore
            without guilt.
          </p>
        </section>

        {/* Check-In */}
        <section id="check-in" data-reveal className="scroll-mt-24 space-y-8 py-4">
          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-semibold">
              Check-In, someone should know how they're doing
            </h2>
            <p className="mx-auto max-w-lg leading-relaxed text-muted-foreground">
              A Check-In is a simple way to make sure someone you care about is doing okay, even
              when you can't be there yourself.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-8">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <CalendarHeartIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-medium">Scheduled Check-In</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                You pick a time. A SomeoneNear team member calls your loved one, asks how their day
                went, whether they've eaten, had water, taken their medication, or simply how they're
                feeling. Afterwards a short update appears on your family dashboard.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-8">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <PhoneCallIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-medium">On-Demand Check-In</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Some days you don't want to wait. Home early, feeling low, or just wanting someone
                to talk to, they can ask for an earlier Check-In. If a trained listener is free, the
                call happens then; otherwise we move it to the nearest time that works.
              </p>
            </div>
          </div>
          <p className="mx-auto max-w-lg text-center text-sm leading-relaxed text-muted-foreground">
            It isn't therapy or diagnosis. It's being present, listening, asking the right everyday
            questions, and giving families a clearer picture of how their loved one is doing.
          </p>
          <div className="text-center">
            <Button asChild variant="ghost" className="rounded-2xl">
              <Link to="/docs/check-in">Read how Check-Ins work</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section data-reveal className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-semibold">More than just a chat</h2>
            <p className="text-muted-foreground">
              It's a presence you can feel. Small things, built for the in-between hours.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary/40"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Supportive empty state, in its own words */}
        <section data-reveal className="space-y-4">
          <h2 className="font-display text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            When there's nothing here yet
          </h2>
          <QuietEmptyState
            quote="That moment when you want to tell someone about your day, and realise there's no one to tell."
            title="This space is waiting for you"
            body="Start with one sentence about today. There's no wrong way to begin, and nobody is keeping score."
            variant="note"
            action={
              <Button asChild className="rounded-2xl px-6">
                <Link to={nextStep}>Say the first thing</Link>
              </Button>
            }
          />
        </section>

        {/* Quiet live numbers */}
        <section data-reveal className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "People here", value: formatCount(stats.members) },
            { label: "Listener calls held", value: formatCount(stats.sessions) },
            { label: "Check-ins shared", value: formatCount(stats.checkins) },
          ].map((s) => (

            <div
              key={s.label}
              className="rounded-xl border border-border bg-surface px-6 py-7 text-center"
            >
              <p className="font-display text-2xl font-semibold">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* Campaign line */}
        <section data-reveal className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 px-8 py-12 text-center">
          <h2 className="font-display text-3xl font-medium text-foreground">
            You can't always be there.
            <br />
            But what if someone could?
          </h2>
          <p className="mx-auto max-w-md leading-relaxed text-muted-foreground">
            People still care. Life just got busy. SomeoneNear stands in the gap, quietly,
            kindly, whenever it's needed.
          </p>
          <div className="pt-2">
            <Button asChild size="lg" className="px-8">
              <Link to={nextStep}>Bring someone near</Link>
            </Button>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" data-reveal className="scroll-mt-24 space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-semibold">Simple, flexible pricing</h2>
            <p className="text-muted-foreground">
              Choose the plan that fits your life. Change or leave any month.
            </p>
          </div>
          <div className="space-y-4">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-xl border p-6 ${
                  p.highlight ? "border-primary/45 bg-surface" : "border-border bg-card"
                }`}
              >
                {p.highlight ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary-foreground">
                    Most chosen
                  </span>
                ) : null}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-medium">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.note}</p>
                  </div>
                  <p className="font-display text-2xl font-semibold">
                    {p.price}
                    <span className="text-sm font-normal text-muted-foreground"> / month</span>
                  </p>
                </div>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" data-reveal className="scroll-mt-24 space-y-6">
          <h2 className="text-center font-display text-3xl font-semibold">
            Questions people quietly ask
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-border">
                <AccordionTrigger className="text-left font-display text-base font-medium">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Safety + contact */}
        <section data-reveal className="space-y-4">
          <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Private by default. Your conversations are yours; family members see only what
              you choose to share. If you're ever in danger, we'll show your local emergency
              numbers first.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <ChartLineIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Something felt off, or missing? Tell us. We read every message.
              </p>
            </div>
            <FeedbackDialog
              trigger={
                <Button variant="secondary" className="rounded-2xl">
                  <ChatCircleTextIcon className="mr-2 h-4 w-4" /> Send feedback
                </Button>
              }
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-6 py-10 text-sm text-muted-foreground">
          <TrustBadge />
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SomeoneNear · Checking in when they can't.</p>
            <a
              href="mailto:care@someonenear.com"
              className="inline-flex items-center gap-2 transition-colors hover:text-primary"
            >
              <EnvelopeSimpleIcon className="h-4 w-4" /> care@someonenear.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
