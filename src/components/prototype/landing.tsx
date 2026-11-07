import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useState, useEffect } from "react";
import {
  PhoneCallIcon,
  PillIcon,
  UsersIcon,
  ChatCircleIcon,
  CalendarHeartIcon,
  HeadphonesIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { SiteHeader, SiteFooter } from "./site-chrome";
import { LaunchPricing } from "./launch-pricing";
import type { MarketId } from "@/lib/launch-catalog";

const Globe = lazy(() =>
  import("./family-globe").then((module) => ({ default: module.FamilyGlobe })),
);
const services = [
  {
    title: "A human voice",
    description: "Friendly listener calls on a regular phone.",
    heading: "Meet Priya, your morning listener",
    detail: "15 minutes to talk about the day, the garden, or whatever is on your mind.",
    action: "Try a check-in",
    result:
      "“Good morning! How are the marigolds looking today?” A small conversation, a little warmth.",
    to: "/docs/listeners",
    icon: PhoneCallIcon,
  },
  {
    title: "Gentle reminders",
    description: "Medication routines, without the nagging.",
    heading: "The everyday, gently remembered",
    detail: "Keep a loved one’s daily routine close, with room for the little details.",
    action: "Try a reminder",
    result: "Morning reminder ✓ A gentle nudge, with time to respond at your own pace.",
    to: "/reminders",
    icon: PillIcon,
  },
  {
    title: "Your family circle",
    description: "Small updates that bring everyone closer.",
    heading: "A little note from home",
    detail: "Your own circle, with sharing you control. Stay close across cities and time zones.",
    action: "See a family update",
    result: "Mum: “Watered the balcony marigolds and had ginger chai ☕🌼”",
    to: "/family",
    icon: UsersIcon,
  },
  {
    title: "Room to talk",
    description: "A calm Companion when the house feels quiet.",
    heading: "A little company, at your pace",
    detail: "A private AI Companion to help you reflect, find words, and talk things through.",
    action: "Try a conversation",
    result: "“I’m here. Would you like to tell me a little about your day?”",
    to: "/companion",
    icon: ChatCircleIcon,
  },
  {
    title: "Memories to keep",
    description: "Photos, voice notes, and future letters.",
    heading: "Something to look forward to",
    detail: "Schedule a message for a birthday, a quiet Sunday, or a moment that matters.",
    action: "Open a sample note",
    result: "“For your next cup of chai: a little hello, and all my love.”",
    to: "/send-later",
    icon: CalendarHeartIcon,
  },
  {
    title: "A quiet moment",
    description: "A little pause and soothing soundscapes.",
    heading: "A small pause, just for you",
    detail: "Take a slow breath. There’s no hurry, and nothing you need to finish right now.",
    action: "Take a quiet moment",
    result: "Breathe in slowly. Let your shoulders soften. Breathe out, in your own time.",
    to: "/companion",
    icon: HeadphonesIcon,
  },
] as const;

export function PrototypeLanding({ market }: { market: MarketId }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [selected, setSelected] = useState(0);
  const [result, setResult] = useState(false);
  useEffect(() => {
    const openCalm = () => {
      setSelected(5);
      setResult(false);
    };
    const fromHash = () => {
      if (location.hash === "#calm-space") openCalm();
    };
    fromHash();
    window.addEventListener("sn:calm-space", openCalm);
    window.addEventListener("hashchange", fromHash);
    return () => {
      window.removeEventListener("sn:calm-space", openCalm);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);
  const current = services[selected];
  const CurrentIcon = current.icon;
  function choose(index: number) {
    setSelected(index);
    setResult(false);
  }
  return (
    <div className="sn-prototype">
      <a className="sn-skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="sn-landing-main">
        <section className="sn-landing-hero" id="for-families">
          <div className="sn-hero-copy">
            <span className="sn-hero-badge">
              💛 A human voice · Gentle reminders · Your AI Companion
            </span>
            <h1>
              Be there for your parents, even when you’re{" "}
              <em className="sn-brush-word">
                miles away.
                <svg
                  className="sn-pink-brush"
                  viewBox="0 0 520 26"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path pathLength="1" d="M6 16C90 5 240 4 514 14" />
                  <path pathLength="1" d="M40 21C160 13 340 12 485 20" />
                </svg>
              </em>
            </h1>
            <p>
              A little conversation, an everyday reminder, a calm moment together. Keep your family
              close, wherever life takes you.
            </p>
            <fieldset className="sn-concerns">
              <legend>What are you worried about today?</legend>
              {[
                ["🌍 They live far away", 2],
                ["💛 They seem lonely", 0],
                ["💊 They forget medication", 1],
                ["📞 I can’t call every day", 0],
                ["📝 Nobody tells me how they are", 2],
                ["📵 They won’t use an app", 0],
              ].map(([label, index]) => (
                <button
                  key={label}
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    choose(Number(index));
                    document.getElementById("service-demos")?.scrollIntoView({ block: "start" });
                  }}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <div className="sn-hero-actions">
              <a className="sn-button" href="#service-demos">
                Explore all 6 services ↓
              </a>
              <Link to="/auth" className="sn-text-link">
                Sign in to your space →
              </Link>
            </div>
          </div>
          <div className="sn-hero-globe">
            <Suspense
              fallback={
                <div className="sn-globe-loading" role="status">
                  Getting your family globe ready…
                </div>
              }
            >
              <Globe />
            </Suspense>
          </div>
          <section className="sn-service-demos" id="service-demos" aria-labelledby="demo-heading">
            <div className="sn-demo-intro">
              <span>Your first 30 seconds</span>
              <h2 id="demo-heading">A little care. In so many ways.</h2>
              <p>
                From a friendly call to a memory worth keeping. Pick a service and see a little
                moment of care.
              </p>
            </div>
            <div className="sn-demo-grid">
              {services.map((service, index) => {
                const Icon = service.icon;
                return (
                  <button
                    type="button"
                    id={index === 5 ? "calm-space" : undefined}
                    className="sn-service-card"
                    aria-pressed={selected === index}
                    aria-controls="service-demo-panel"
                    key={service.title}
                    onClick={() => choose(index)}
                  >
                    <Icon size={25} aria-hidden="true" />
                    <strong>{service.title}</strong>
                    <span>{service.description}</span>
                    <small>Try a quick demo →</small>
                  </button>
                );
              })}
            </div>
            <div
              className="sn-demo-panel"
              id="service-demo-panel"
              role="region"
              aria-label={`${current.title} demonstration`}
            >
              <div>
                <span className="sn-demo-kicker">{current.title} · Interactive sample</span>
                <h3>{current.heading}</h3>
                <p>{current.detail}</p>
                <div className="sn-demo-actions">
                  <button className="sn-button" type="button" onClick={() => setResult(!result)}>
                    {result ? "Reset demo" : current.action}
                  </button>
                  <Link to={current.to} className="sn-text-link">
                    Explore {current.title.toLowerCase()} →
                  </Link>
                </div>
              </div>
              <div className="sn-demo-result" aria-live="polite">
                {result ? <CheckCircleIcon size={32} /> : <CurrentIcon size={32} />}
                <p>{result ? current.result : "Tap the demo button to see how it feels."}</p>
              </div>
            </div>
            <p className="sn-demo-footnote">
              These are sample moments. No calls, messages, or reminders are sent.
            </p>
          </section>
        </section>
        <section className="sn-how" id="how-it-works" aria-labelledby="how-heading">
          <span className="sn-section-label">A simple start</span>
          <h2 id="how-heading">Closer, in three small steps.</h2>
          <p>Build a little care into your family’s everyday rhythm.</p>
          <div className="sn-how-grid">
            {[
              [
                "Make your family space",
                "Invite a loved one and choose what you’re comfortable sharing.",
              ],
              [
                "Find your kind of care",
                "Set a gentle reminder, talk to your Companion, or take a quiet moment.",
              ],
              [
                "Keep the connection going",
                "Share everyday updates and memories with the people who matter to you.",
              ],
            ].map(([title, detail], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>
        <LaunchPricing initialMarket={market} />
      </main>
      <SiteFooter />
    </div>
  );
}
