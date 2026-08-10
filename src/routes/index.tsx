import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Heart,
  MessageCircleHeart,
  BookHeart,
  Users,
  LineChart,
  Shield,
  HeartHandshake,
  Check,
  Sparkles,
  PhoneCall,
  Sun,
  Star,
  Quote,
  Clock,
  ArrowRight,
  Mail,
  LifeBuoy,
  MessageSquareHeart,
} from "lucide-react";
import { FeedbackDialog } from "@/components/feedback-dialog";


import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import familyHero from "@/assets/landing-family.png";
import avatarGrandma from "@/assets/avatar-grandma.png";
import avatarDad from "@/assets/avatar-dad.png";
import avatarMom from "@/assets/avatar-mom.png";
import avatarTeen from "@/assets/avatar-teen.png";
import avatarKid from "@/assets/avatar-kid.png";
import { supabase } from "@/integrations/supabase/client";
import { getPublicStats } from "@/lib/stats.functions";

export const Route = createFileRoute("/")({
  loader: () => getPublicStats(),
  head: () => ({
    meta: [
      { title: "BesideU — Checking in when they can't" },
      {
        name: "description",
        content:
          "BesideU is a warm family care membership — AI Companion, private journal, human listeners, and a shared circle that keeps your loved ones close.",
      },
      { property: "og:title", content: "BesideU — Checking in when they can't" },
      {
        property: "og:description",
        content:
          "BesideU is a warm family care membership — AI Companion, private journal, human listeners, and a shared circle that keeps your loved ones close.",
      },
    ],
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


const familyAvatars = [
  { src: avatarGrandma, name: "Grandma Anu", role: "Cared for" },
  { src: avatarDad, name: "Rohan", role: "Owner" },
  { src: avatarMom, name: "Priya", role: "Adult" },
  { src: avatarTeen, name: "Aria", role: "Teen" },
  { src: avatarKid, name: "Kabir", role: "Kid" },
];

function Landing() {
  const stats = useLiveStats(Route.useLoaderData());
  const heroRef = useRef<HTMLElement | null>(null);
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

  const nextStep: "/dashboard" | "/auth" = signedIn ? "/dashboard" : "/auth";

  // Subtle pointer-driven parallax: writes --px / --py (-1..1) on the hero root.
  // Layers read those vars at different depths so background, character, and
  // orbit ring drift independently without any layout shift.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let raf = 0;
    let tx = 0, ty = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty("--px", tx.toFixed(3));
          el.style.setProperty("--py", ty.toFixed(3));
          raf = 0;
        });
      }
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll-triggered reveal for any [data-reveal] element on this page.
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

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl gradient-sunrise text-neutral-900 shadow-glow">
            <Heart className="h-5 w-5 animate-heartbeat" strokeWidth={2.6} fill="currentColor" />
            <span className="absolute inset-0 rounded-2xl gradient-sunrise animate-pulse-ring" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">BesideU</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-brand hidden sm:inline-flex">
            <Link to="/docs">Docs</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-brand hidden sm:inline-flex">
            <Link to={nextStep}>{signedIn ? "Dashboard" : "Sign in"}</Link>
          </Button>
          <Button asChild className="rounded-brand bg-neutral-900 text-white hover:bg-neutral-800">
            <Link to={nextStep}>{signedIn ? "Open app" : "Start free"}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-6">
        {/* HERO */}
        <section
          ref={heroRef}
          className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] gradient-sunrise p-6 pb-10 shadow-glow sm:p-14 [--px:0] [--py:0] [transition:none] motion-safe:[&_[data-parallax]]:transition-transform motion-safe:[&_[data-parallax]]:duration-[600ms] motion-safe:[&_[data-parallax]]:ease-out"
        >
          {/* Ambient blobs — deepest layer, drift most */}
          <div
            aria-hidden
            data-parallax
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/30 blur-3xl will-change-transform"
            style={{ transform: "translate3d(calc(var(--px) * 24px), calc(var(--py) * 24px), 0)" }}
          />
          <div
            aria-hidden
            data-parallax
            className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-white/25 blur-3xl will-change-transform"
            style={{ transform: "translate3d(calc(var(--px) * -20px), calc(var(--py) * -20px), 0)" }}
          />
          <div
            aria-hidden
            data-parallax
            className="absolute right-10 top-10 h-24 w-24 rounded-full bg-mint/40 blur-2xl animate-float will-change-transform"
            style={{ transform: "translate3d(calc(var(--px) * 30px), calc(var(--py) * 30px), 0)" }}
          />


          <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(19rem,1fr)] md:items-center">
            <div className="text-neutral-900 animate-fade-up">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> A family care membership
              </p>

              {/* SLOGAN */}
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-coral">
                Distance shouldn't become disconnection.
              </p>

              <h1 className="mt-2 max-w-2xl text-[2.1rem] leading-[1.05] font-bold tracking-tight sm:text-5xl md:text-5xl lg:text-6xl">
                Checking in
                <br />
                <span className="relative inline-block">when they can't.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-neutral-800/85 sm:text-lg">
                BesideU is the gentle heartbeat between your family — an AI companion for tough evenings,
                a private journal for your own thoughts, and human listeners for the days a real
                voice matters most.
              </p>


              {/* Family avatar row — the emotional proof */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {familyAvatars.map((a, i) => (
                    <img
                      key={a.name}
                      src={a.src}
                      alt={a.name}
                      loading="lazy"
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-soft animate-pop-in"
                      style={{ animationDelay: `${i * 90}ms` }}
                    />
                  ))}
                </div>
                <div className="text-sm text-neutral-800/80">
                  <span className="font-semibold text-neutral-900">2,400+ families</span> keeping
                  each other close
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  size="lg"
                  className="rounded-2xl bg-neutral-900 px-6 text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:bg-neutral-800"
                >
                  <Link to={nextStep}>{signedIn ? "Open dashboard" : "Start 7-day free trial"}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="rounded-2xl bg-white/75 text-neutral-900 backdrop-blur hover:bg-white"
                >
                  <Link to={nextStep}>{signedIn ? "Continue where I left off" : "I already have an account"}</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-neutral-800/70">
                No card details for the first minute. Cancel anytime. Not therapy or an emergency service.
              </p>
            </div>

            {/* Hero visual — family illustration + orbiting avatars */}
            <div className="relative mx-auto w-full max-w-md md:max-w-none px-4 sm:px-6 md:px-0 overflow-hidden">
              <div className="orbit-stage relative aspect-square w-full mx-auto overflow-hidden [perspective:1000px] max-h-[70vh] sm:max-h-[75vh] md:max-h-[80vh] max-w-[min(100%,70vh)] sm:max-w-[min(100%,75vh)] md:max-w-[min(100%,80vh)]">

                {/* Soft halo */}
                <div
                  aria-hidden
                  data-parallax
                  className="absolute inset-6 rounded-full bg-white/50 blur-2xl will-change-transform"
                  style={{ transform: "translate3d(calc(var(--px) * 10px), calc(var(--py) * 10px), 0)" }}
                />
                {/* Character layer */}
                <div
                  data-parallax
                  className="absolute inset-0 will-change-transform"
                  style={{ transform: "translate3d(calc(var(--px) * -14px), calc(var(--py) * -14px), 0)" }}
                >
                  <div className="absolute inset-4 sm:inset-6 rounded-full overflow-hidden ring-8 ring-white/60 shadow-glow bg-white/40 animate-fade-up">
                    <img
                      src={familyHero}
                      alt="A warm multi-generational family embracing"
                      width={640}
                      height={640}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Orbit ring — rotating parent carries avatars; children counter-rotate to stay upright */}
                <div
                  aria-hidden
                  data-parallax
                  className="pointer-events-none absolute inset-0 will-change-transform"
                  style={{ transform: "translate3d(calc(var(--px) * 20px), calc(var(--py) * 20px), 0)" }}
                >
                  <div className="hero-orbit-ring orbit-ring absolute inset-0 [--orbit-r:7.5rem] sm:[--orbit-r:9.5rem] md:[--orbit-r:8rem] lg:[--orbit-r:12.5rem]">
                    {[avatarGrandma, avatarDad, avatarMom, avatarTeen, avatarKid].map((src, i) => {
                      const angle = (360 / 5) * i;
                      const delay = `${i * 0.35}s`;
                      return (
                        <div
                          key={i}
                          className="orbit-slot absolute left-1/2 top-1/2 h-11 w-11 lg:h-12 lg:w-12 -ml-[22px] -mt-[22px] lg:-ml-6 lg:-mt-6"
                          style={{
                            transform: `rotate(${angle}deg) translateX(var(--orbit-r)) rotate(-${angle}deg) translateZ(0)`,
                          }}
                        >
                          <div className="hero-orbit-counter orbit-counter h-full w-full">
                            <div
                              className="hero-avatar-bob orbit-avatar group relative h-full w-full"
                              style={{ animationDelay: delay }}
                            >
                              {/* soft pulsing halo — radial gradient, no blur filter */}
                              <span
                                className="hero-avatar-glow orbit-halo pointer-events-none absolute -inset-1 rounded-full"
                                style={{
                                  background:
                                    "radial-gradient(closest-side, hsl(var(--primary) / 0.55), hsl(var(--coral) / 0.35) 60%, transparent 75%)",
                                  animationDelay: delay,
                                }}
                              />
                              <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                width={48}
                                height={48}
                                className="orbit-img relative h-full w-full rounded-full border-[3px] border-white object-cover shadow-soft bg-white transition-transform duration-300 group-hover:scale-110"
                              />
                              {/* online dot */}
                              <span
                                className="hero-avatar-glow orbit-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-sage border-2 border-white"
                                style={{ animationDelay: delay }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Floating chat bubble — parallax wrapper + independent float animation */}
                <div
                  data-parallax
                  className="absolute left-2 top-6 max-w-[calc(100%-1rem)] will-change-transform sm:left-3 sm:top-10"
                  style={{ transform: "translate3d(calc(var(--px) * 36px), calc(var(--py) * 36px), 0)" }}
                >
                  <div className="hero-status-float rounded-2xl bg-white/95 px-3 py-2 text-xs shadow-soft sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sage animate-bloom" />
                      <span className="font-medium">Mom checked in ❤️</span>
                    </div>
                  </div>
                </div>
                {/* Floating listener chip — parallax wrapper + independent float animation */}
                <div
                  data-parallax
                  className="absolute bottom-6 right-2 max-w-[calc(100%-1rem)] will-change-transform sm:bottom-10 sm:right-3"
                  style={{ transform: "translate3d(calc(var(--px) * -36px), calc(var(--py) * -36px), 0)" }}
                >
                  <div className="hero-status-float hero-status-float-delayed rounded-2xl bg-white/95 px-3 py-2 text-xs shadow-soft sm:text-sm">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-3.5 w-3.5 text-coral" />
                      <span className="font-medium">Listener on standby</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Stats band — live numbers from the BesideU database */}
        <section className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4">
          {[
            {
              k: formatCount(stats.members),
              v: stats.members === 1 ? "member held close" : "members held close",
              tone: "gradient-peach",
              icon: HeartHandshake,
            },
            {
              k: formatCount(stats.checkins),
              v: "gentle check-ins",
              tone: "gradient-mint",
              icon: Heart,
            },
            stats.avg_rating != null
              ? {
                  k: `${stats.avg_rating}★`,
                  v: `listener rating (${stats.rating_count})`,
                  tone: "gradient-blush",
                  icon: Star,
                }
              : {
                  k: formatCount(stats.active_listeners),
                  v: "listeners on standby",
                  tone: "gradient-blush",
                  icon: Star,
                },
            { k: "24/7", v: "companion, always", tone: "gradient-lilac", icon: Clock },
          ].map((s, i) => (

            <div
              key={s.v}
              className={`relative overflow-hidden rounded-3xl p-5 shadow-soft card-hover ${s.tone} animate-fade-up`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <s.icon aria-hidden className="absolute -right-3 -bottom-3 h-16 w-16 text-white/50" strokeWidth={1.4} />
              <div className="text-3xl font-bold text-neutral-900 sm:text-4xl">{s.k}</div>
              <div className="mt-1 text-xs font-medium text-neutral-800/80 sm:text-sm">{s.v}</div>
            </div>
          ))}
        </section>

        {/* Mission statement */}
        <section className="mt-12 sm:mt-16" data-reveal>
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] gradient-sunrise p-8 sm:p-12 lg:p-16 text-center shadow-glow">
            <div
              aria-hidden
              className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/30 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/25 blur-3xl"
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
                Our mission
              </p>
              <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold leading-snug tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
                Distance shouldn’t become disconnection.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-800/85 sm:text-lg">
                People still care. Life just got busy. BesideU exists to keep the people who matter
                close — even when the world pulls them apart.
              </p>
            </div>
          </div>
        </section>

        {/* How it works — colorful 3-step */}
        <section className="py-16 sm:py-24">
          <div className="text-center animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
              Three tiny steps
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Start a warmer week in under a minute.
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", t: "Create your circle", d: "Invite parents, siblings, or your own quiet corner. Everyone chooses what they share.", tone: "gradient-sunrise" },
              { n: "02", t: "Check in your way", d: "A mood tap, a journal line, or a chat with your Companion — however small.", tone: "gradient-sky" },
              { n: "03", t: "Feel each other close", d: "Gentle signals travel across the circle. Book a real listener when a voice helps.", tone: "gradient-sage" },
            ].map((s, i) => (
              <li
                key={s.n}
                className={`relative rounded-3xl p-6 shadow-soft card-hover ${s.tone} animate-fade-up`}
                style={{ animationDelay: `${i * 110}ms` }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-black text-white/70 drop-shadow-sm">{s.n}</span>
                  <ArrowRight className="h-5 w-5 text-neutral-800/60" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-neutral-900">{s.t}</h3>
                <p className="mt-2 text-sm text-neutral-800/80">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Story / how BesideU cares */}
        <section className="pb-16 sm:pb-24">
          <div className="text-center animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
              Why BesideU exists
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Because "how are you?" deserves a real answer.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Distance, time zones, and busy days pull families apart. BesideU stitches the moments
              back — quietly, with consent, and always at your pace.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "For the one who feels alone",
                body: "Talk it through with a warm AI Companion at 2 a.m., or write it down in a journal that stays yours.",
                icon: MessageCircleHeart,
                tone: "gradient-peach",
                emoji: "🌙",
              },
              {
                title: "For the one who worries",
                body: "See gentle mood signals from loved ones — no scores, no snooping. Just presence.",
                icon: HeartHandshake,
                tone: "gradient-blush",
                emoji: "🤍",
              },
              {
                title: "For the whole family",
                body: "One membership. Every generation. Human listeners on the days that need a real voice.",
                icon: Users,
                tone: "gradient-sage",
                emoji: "👨‍👩‍👧‍👦",
              },
            ].map((c, i) => (
              <div
                key={c.title}
                className={`relative overflow-hidden rounded-3xl p-6 shadow-soft card-hover ${c.tone} animate-fade-up`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="text-3xl">{c.emoji}</div>
                <h3 className="mt-3 text-lg font-semibold text-neutral-900">{c.title}</h3>
                <p className="mt-2 text-sm text-neutral-800/80">{c.body}</p>
                <c.icon
                  aria-hidden
                  className="absolute -right-4 -bottom-4 h-24 w-24 text-white/40"
                  strokeWidth={1.5}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials — warm, personal */}
        <section className="pb-8">
          <div className="text-center animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
              Family voices
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Little moments, held together.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                q: "My mom lives 8,000 km away. BesideU is how I know she slept okay.",
                by: "Rohan, 32 — Owner",
                img: avatarDad,
                tone: "gradient-peach",
              },
              {
                q: "The journal is mine. The circle is ours. That balance is everything.",
                by: "Priya, 29 — Adult",
                img: avatarMom,
                tone: "gradient-blush",
              },
              {
                q: "I booked a listener at 11pm on a Tuesday. She didn't try to fix me. She just heard me.",
                by: "Aria, 17 — Teen",
                img: avatarTeen,
                tone: "gradient-lilac",
              },
            ].map((t, i) => (
              <figure
                key={t.by}
                className={`relative rounded-3xl p-6 shadow-soft card-hover ${t.tone} animate-fade-up`}
                style={{ animationDelay: `${i * 110}ms` }}
              >
                <Quote aria-hidden className="absolute right-4 top-4 h-8 w-8 text-white/70" />
                <blockquote className="text-base font-medium leading-relaxed text-neutral-900">
                  "{t.q}"
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <img
                    src={t.img}
                    alt=""
                    loading="lazy"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-soft"
                  />
                  <div className="text-sm font-semibold text-neutral-900/85">{t.by}</div>
                </figcaption>
                <div className="mt-3 flex gap-0.5 text-coral">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
              </figure>
            ))}
          </div>
        </section>

        {/* Marquee of family voices */}

        <section className="relative py-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
          <div className="overflow-hidden">
            <div className="flex w-max gap-4 animate-marquee">
              {[...familyAvatars, ...familyAvatars, ...familyAvatars].map((a, i) => (
                <div
                  key={i}
                  className="flex min-w-[220px] items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-soft"
                >
                  <img
                    src={a.src}
                    alt={a.name}
                    loading="lazy"
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
                  />
                  <div>
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What's inside — feature showcase with mini mocks */}
        <section id="whats-inside" className="scroll-mt-24 py-16 sm:py-24">
          <div className="text-center" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
              What's inside your membership
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Every tool your family needs — in one warm place.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              A quick peek at the six spaces you unlock the moment you sign in.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. AI Companion */}
            <FeatureCard
              tone="gradient-peach"
              icon={MessageCircleHeart}
              title="AI Companion"
              body="A calm space to talk things through, 24/7 — with safety-first guardrails."
              delay={0}
            >
              <div className="mt-4 space-y-2">
                <div className="ml-auto w-4/5 rounded-2xl rounded-tr-sm bg-white/90 px-3 py-2 text-xs text-neutral-800 shadow-soft">
                  I couldn't sleep again.
                </div>
                <div className="w-4/5 rounded-2xl rounded-tl-sm bg-neutral-900 px-3 py-2 text-xs text-white shadow-soft">
                  I'm here. Want to name what's on your mind, one thing at a time?
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-700/80">
                  <span className="h-1.5 w-1.5 animate-bloom rounded-full bg-sage" />
                  Companion typing…
                </div>
              </div>
            </FeatureCard>

            {/* 2. Private Journal */}
            <FeatureCard
              tone="gradient-mint"
              icon={BookHeart}
              title="Private Journal"
              body="Yours alone. Never shared with family or Listeners."
              delay={80}
            >
              <div className="mt-4 rounded-2xl bg-white/90 p-3 shadow-soft">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                  <span>Tue · 9:42 pm</span>
                  <span className="rounded-full bg-mint/40 px-2 py-0.5 font-semibold text-neutral-700">
                    🔒 private
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-800">
                  Small win: called Mom before dinner. She laughed at the dog story…
                </p>
                <div className="mt-3 flex gap-1">
                  {["🙂", "🌱", "💛"].map((e) => (
                    <span key={e} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </FeatureCard>

            {/* 3. Human Listeners */}
            <FeatureCard
              tone="gradient-blush"
              icon={PhoneCall}
              title="Human Listeners"
              body="Verified people to hear you — book only when you're ready."
              delay={160}
            >
              <div className="mt-4 rounded-2xl bg-white/90 p-3 shadow-soft">
                <div className="flex items-center gap-2">
                  <img
                    src={avatarMom}
                    alt=""
                    className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-soft"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-neutral-900">Neha · Listener</div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-600">
                      <Star className="h-3 w-3 text-coral" fill="currentColor" strokeWidth={0} /> Verified listener · trained in active listening
                    </div>
                  </div>
                  <span className="rounded-full bg-sage/25 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                    Today 8pm
                  </span>
                </div>
              </div>
            </FeatureCard>

            {/* 4. Family Circle & Admin — the requested "admin dashboard" preview */}
            <FeatureCard
              tone="gradient-lilac"
              icon={HeartHandshake}
              title="Family Circle & Admin"
              body="Owners manage roles, invites, and allocate the monthly session pool."
              delay={0}
            >
              <div className="mt-4 rounded-2xl bg-white/90 p-3 shadow-soft">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                  <span>Session pool</span>
                  <span className="font-semibold text-neutral-700">8 / 12 left</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-coral to-sunrise-from" />
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    { name: "Rohan", role: "Owner", used: 2, of: 4 },
                    { name: "Priya", role: "Adult", used: 1, of: 4 },
                    { name: "Aria", role: "Teen", used: 1, of: 4 },
                  ].map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between rounded-lg bg-neutral-50 px-2 py-1 text-[11px]"
                    >
                      <span className="font-medium text-neutral-800">
                        {m.name}
                        <span className="ml-1 text-neutral-500">· {m.role}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-neutral-700">
                        {m.used}/{m.of}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </FeatureCard>

            {/* 5. Gentle Insights */}
            <FeatureCard
              tone="gradient-sky"
              icon={LineChart}
              title="Gentle Insights"
              body="Mood trends and streaks — never a score, never a judgment."
              delay={80}
            >
              <div className="mt-4 rounded-2xl bg-white/90 p-3 shadow-soft">
                <div className="flex items-end gap-1.5 h-16">
                  {[35, 55, 40, 68, 50, 78, 62].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-sky-300 to-coral/80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
                  <span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span>
                </div>
              </div>
            </FeatureCard>

            {/* 6. Safety First */}
            <FeatureCard
              tone="gradient-sage"
              icon={Shield}
              title="Safety First"
              body="Crisis resources one tap away — regional hotlines and grounding."
              delay={160}
            >
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-soft">
                  <LifeBuoy className="h-4 w-4 text-coral" />
                  <span className="text-xs font-medium text-neutral-900">Talk to someone now</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-soft">
                  <Sparkles className="h-4 w-4 text-coral" />
                  <span className="text-xs font-medium text-neutral-900">Try 60-sec grounding</span>
                </div>
              </div>
            </FeatureCard>
          </div>
        </section>

        {/* Emotional campaign — the truth behind the product */}
        <section className="py-16 sm:py-24" data-reveal>
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] gradient-blush p-8 sm:p-12 lg:p-16 text-center shadow-soft">
            <div
              aria-hidden
              className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/40 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-coral/20 blur-3xl"
            />
            <div className="relative">
              <Quote className="mx-auto h-10 w-10 text-coral" strokeWidth={1.5} />
              <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-bold leading-snug tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
                People still care.
                <br />
                Life just got busy.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base text-neutral-800/85 sm:text-lg">
                BesideU is built for the quiet guilt of not calling enough, the missed birthdays,
                and the late-night worry that sits in your chest. We make it easier to show up —
                without making anyone feel like a burden.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-neutral-900 backdrop-blur">
                  <Heart className="h-4 w-4 text-coral" /> No guilt. Just gentle check-ins.
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-neutral-900 backdrop-blur">
                  <Clock className="h-4 w-4 text-coral" /> Takes under a minute.
                </span>
              </div>
            </div>
          </div>
        </section>


        {/* FAQ — accordion with smooth expand/collapse */}
        <section id="faq" className="scroll-mt-24 py-16 sm:py-24">

          <div className="mx-auto max-w-3xl">
            <div className="text-center animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
                Questions & answers
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                The things families usually ask us
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Everything about privacy, billing, roles, and how BesideU keeps your circle calm and connected.
              </p>
            </div>

            <div className="mt-10 rounded-3xl bg-card p-2 shadow-soft sm:p-4 animate-fade-up">
              <Accordion type="single" collapsible className="w-full">
                {[
                  {
                    q: "What exactly does BesideU do?",
                    a: "BesideU is a gentle family care membership. It combines an AI Companion for late-night worries, a completely private journal, mood check-ins, and human Listeners you can book when a real voice matters. Family plans keep everyone connected under clear roles and consent.",
                  },
                  {
                    q: "Is the journal private from family members?",
                    a: "Yes. Your journal is yours alone. Family members see only the check-in mood signals you choose to share. Listeners never see journal entries unless you explicitly read something aloud during a session.",
                  },
                  {
                    q: "How do the 7-day free trial and billing work?",
                    a: "Start the Together plan free for 7 days. We collect a payment method upfront, but you won't be charged until the trial ends. Cancel anytime in Settings before the trial ends and you won't be billed.",
                  },
                  {
                    q: "Can I change plans or cancel later?",
                    a: "Absolutely. Owners can switch tiers, upgrade, downgrade, or cancel from the Billing section in Settings. Changes take effect immediately and any prorated credits are handled by Stripe.",
                  },
                  {
                    q: "What are the roles in a Family Circle?",
                    a: "Owner manages the plan, billing, and session pool. Adults see shared family check-ins and can invite others. Teens keep private journals and can use the Companion and Listeners. Kids are limited to gentle check-ins shared with guardians.",
                  },
                  {
                    q: "Are Listener sessions therapy or medical advice?",
                    a: "No. BesideU Listeners are trained to offer a calm, non-judgmental ear. They do not diagnose, treat, or provide medical advice. If you are in crisis, we always show local emergency resources and hotlines.",
                  },
                  {
                    q: "Is my data safe and where is it stored?",
                    a: "We use end-to-end encrypted auth, strict Row-Level Security in our backend, and never sell your data. Messages are stored so the Companion can remember context, and you can ask us about deletion anytime.",
                  },
                ].map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-2xl border-b border-border/60 px-4 py-1 transition-colors last:border-b-0 data-[state=open]:bg-gradient-to-r data-[state=open]:from-sunrise-from/10 data-[state=open]:to-blush/10"
                  >
                    <AccordionTrigger className="text-sm font-semibold text-neutral-900 hover:no-underline sm:text-base [&[data-state=open]>svg]:text-coral">
                      <span className="flex items-center gap-3 text-left">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-bold text-coral">
                          {i + 1}
                        </span>
                        {item.q}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pl-10 text-sm leading-relaxed text-neutral-800/80">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 pb-24">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
              Care Membership
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Pick the plan that fits your family
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Human Listener sessions belong to the family — Owner allocates freely.
              Prices in ₹ INR (USD equivalents at checkout).
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: "Together",
                price: "₹799",
                period: "/mo · $8.99",
                features: ["1 member", "4 Human Listener sessions / month", "AI Companion, Mood, Journal", "4 free reschedules"],
              },
              {
                name: "Family",
                price: "₹1,499",
                period: "/mo · $15.99",
                highlight: true,
                features: ["Up to 3 members", "12 Human Listener sessions / month", "Owner allocates freely", "Family dashboard & shared check-ins", "8 free reschedules"],
              },
              {
                name: "Care",
                price: "₹3,499",
                period: "/mo · $36.99",
                features: ["Up to 4 members (seniors & long-distance)", "24 Human Listener sessions / month", "Priority booking", "12 free reschedules"],
              },
            ].map((t) => (
              <div
                key={t.name}
                className={`relative rounded-brand border p-6 card-hover ${
                  t.highlight
                    ? "border-coral bg-white shadow-glow sm:scale-[1.01]"
                    : "border-border bg-card"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full gradient-sunrise px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-900 shadow-soft">
                    Most loved
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{t.price}</span>
                  <span className="text-sm text-muted-foreground">{t.period}</span>
                </div>
                <h3 className="mt-1 text-base font-semibold">{t.name}</h3>
                <ul className="mt-4 space-y-2">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 text-coral" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              className="rounded-2xl gradient-sunrise px-8 text-neutral-900 shadow-glow hover:-translate-y-0.5 transition-transform"
            >
              <Link to={nextStep}>
                <Sun className="mr-2 h-4 w-4" /> Start your family's BesideU
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              7-day free trial on Together. No commitment.
            </p>
          </div>
        </section>

        {/* Final CTA — clear next step */}
        <section className="mt-8 sm:mt-12" data-reveal>
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-neutral-900 p-8 sm:p-12 lg:p-16 text-center shadow-glow">
            <div
              aria-hidden
              className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-coral/20 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-coral">
                Ready when you are
              </p>
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Start checking in today.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-white/80 sm:text-lg">
                Take the next step for the people you love. It takes under a minute, and your first week is free.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="rounded-2xl gradient-sunrise px-8 text-neutral-900 shadow-glow hover:-translate-y-0.5 transition-transform"
                >
                  <Link to={nextStep}>
                    <Heart className="mr-2 h-4 w-4" /> {signedIn ? "Open dashboard" : "Start your free 7-day trial"}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="rounded-2xl bg-white/10 px-8 text-white backdrop-blur hover:bg-white/20"
                >
                  <Link to={nextStep}>{signedIn ? "Continue where I left off" : "I already have an account"}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ============= FOOTER ============= */}
        <footer className="mt-16 rounded-t-[2rem] sm:rounded-t-[2.5rem] gradient-peach px-6 pb-10 pt-12 sm:px-10 sm:pt-14 shadow-soft">
          {/* Support + feedback CTA band */}
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-900 backdrop-blur">
                <HeartHandshake className="h-3.5 w-3.5" /> We're listening
              </p>
              <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                Your voice shapes BesideU.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-neutral-800/85 sm:text-base">
                Every message — feature idea, bug, or gentle nudge — goes straight into our product review.
                We read them all.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
              <FeedbackDialog
                trigger={
                  <Button size="lg" className="rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800">
                    <MessageSquareHeart className="mr-2 h-4 w-4" /> Send feedback
                  </Button>
                }
              />
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-2xl bg-white/80 text-neutral-900 backdrop-blur hover:bg-white"
              >
                <a href="mailto:besideU.customercare@support.com">
                  <Mail className="mr-2 h-4 w-4" /> Email support
                </a>
              </Button>
            </div>
          </div>

          {/* Link columns */}
          <div className="mt-10 grid gap-8 border-t border-white/50 pt-8 sm:grid-cols-2 md:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl gradient-sunrise text-neutral-900 shadow-soft">
                  <Heart className="h-4 w-4" fill="currentColor" />
                </span>
                <span className="text-base font-semibold tracking-tight text-neutral-900">BesideU</span>
              </div>
              <p className="mt-3 text-sm text-neutral-800/80">
                A warm family care membership. Love, on the same page.
              </p>
              <p className="mt-4 text-[11px] text-neutral-800/70">
                © {new Date().getFullYear()} BesideU. Made with care.
              </p>
            </div>

            {/* Customer support */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-900/80">
                Customer support
              </h4>
              <ul className="mt-4 space-y-3 text-sm text-neutral-900">
                <li>
                  <a
                    href="mailto:besideU.customercare@support.com"
                    className="group inline-flex items-start gap-2 hover:text-coral"
                  >
                    <Mail className="mt-0.5 h-4 w-4 text-coral" />
                    <span>
                      <span className="block font-medium">Email us</span>
                      <span className="text-xs text-neutral-800/75">besideU.customercare@support.com</span>
                    </span>
                  </a>
                </li>
                <li>
                  <Link
                    to="/companion"
                    className="group inline-flex items-start gap-2 hover:text-coral"
                  >
                    <MessageCircleHeart className="mt-0.5 h-4 w-4 text-coral" />
                    <span>
                      <span className="block font-medium">In-app chat</span>
                      <span className="text-xs text-neutral-800/75">AI answers first, human when you need one</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <a href="#faq" className="group inline-flex items-start gap-2 hover:text-coral">
                    <LifeBuoy className="mt-0.5 h-4 w-4 text-coral" />
                    <span>
                      <span className="block font-medium">Help Centre / FAQs</span>
                      <span className="text-xs text-neutral-800/75">Answers to the most-asked questions</span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Feedback categories */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-900/80">
                Share feedback
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-neutral-900">
                {[
                  { label: "Feature request", cat: "feature_request" as const },
                  { label: "Bug report", cat: "bug_report" as const },
                  { label: "Product feedback", cat: "product_feedback" as const },
                  { label: "AI Companion feedback", cat: "ai_feedback" as const },
                  { label: "Listener feedback", cat: "listener_feedback" as const },
                ].map((f) => (
                  <li key={f.cat}>
                    <FeedbackDialog
                      defaultCategory={f.cat}
                      trigger={
                        <button className="group inline-flex items-center gap-2 text-left hover:text-coral">
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 -ml-1 transition-all group-hover:ml-0 group-hover:opacity-100" />
                          <span>{f.label}</span>
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-neutral-800/70">
                Every submission enters our product review queue.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-900/80">
                Product
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-neutral-900">
                <li><Link to={nextStep} className="hover:text-coral">{signedIn ? "Open dashboard" : "Start free trial"}</Link></li>
                <li><Link to={nextStep} className="hover:text-coral">{signedIn ? "Continue" : "Sign in"}</Link></li>
                <li><Link to="/docs" className="hover:text-coral">Docs</Link></li>
                <li><a href="#pricing" className="hover:text-coral">Pricing</a></li>
                <li><a href="#faq" className="hover:text-coral">FAQ</a></li>
                <li><Link to="/safety" className="hover:text-coral">Safety & crisis</Link></li>
              </ul>
            </div>
          </div>

          {/* Safety disclaimer */}
          <div className="mt-10 rounded-2xl bg-white/60 p-4 text-center text-[11px] text-neutral-800/80 backdrop-blur">
            BesideU is not therapy, medical care, or an emergency service. If you're in crisis,
            please dial your local emergency line.
          </div>
        </footer>

      </main>
    </div>
  );
}

function FeatureCard({
  tone,
  icon: Icon,
  title,
  body,
  delay = 0,
  children,
}: {
  tone: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  delay?: number;
  children?: ReactNode;
}) {
  return (
    <div
      data-reveal
      style={{ transitionDelay: `${delay}ms` }}
      className={`group relative overflow-hidden rounded-3xl p-6 shadow-soft card-hover ${tone}`}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/85 text-neutral-800 shadow-soft transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-neutral-800/80">{body}</p>
      {children}
    </div>
  );
}

