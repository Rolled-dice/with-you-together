import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  HeadphonesIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { FamilyAvatar } from "@/components/family-avatar";

const TOPICS = [
  {
    label: "Everyday company",
    text: "A friendly voice, a familiar routine. Book a fifteen-minute listener call for yourself.",
    to: "/listeners",
  },
  {
    label: "Family reminders",
    text: "Plan a gentle reminder for a relative who has agreed to receive it. They choose what to share back.",
    to: "/family",
  },
  {
    label: "Medication",
    text: "Keep prescriptions and medication reminders together. Review every prescription before saving.",
    to: "/reminders",
  },
] as const;

function IllustrationGlobe() {
  const stage = useRef<HTMLDivElement>(null);
  const motion = useRef({ angle: -0.12, phase: 0, drag: 0, zoom: 1 });
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    import("@/components/family-globe.scene")
      .then(({ createFamilyGlobe }) => {
        if (disposed || !stage.current) return;
        try {
          cleanup = createFamilyGlobe(stage.current, motion.current);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    const tick = (now: number) => {
      if (previous && !paused && !media.matches && !document.hidden)
        motion.current.phase = (motion.current.phase + Math.min(now - previous, 50) / 48000) % 1;
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);
  return (
    <>
      <div
        ref={stage}
        className="care-world"
        data-testid="care-world"
        aria-label="Illustration of a connected family"
      >
        <canvas aria-hidden />
        {failed && <p className="p-8 text-center">A little closer, wherever you are.</p>}
        {!failed &&
          ["Dad", "Mum", "You", "Your circle"].map((name, index) => (
            <span className="family-globe-pin" data-globe-member key={name}>
              <span className="family-globe-portrait">
                <FamilyAvatar fallback={[4, 5, 0, 3][index]} />
              </span>
              <strong>{name}</strong>
            </span>
          ))}
      </div>
      <div className="care-world-controls">
        <Button
          size="icon"
          variant="ghost"
          aria-label={paused ? "Play illustration" : "Pause illustration"}
          title={paused ? "Play illustration" : "Pause illustration"}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
      </div>
      <p className="care-world-caption">An illustrated family circle. Your family stays private.</p>
    </>
  );
}

export function CareHero({ signedIn }: { signedIn: boolean }) {
  const [topic, setTopic] = useState(0);
  return (
    <>
      <section className="care-hero">
        <div className="care-hero-heading">
          <p className="care-eyebrow">
            <ShieldCheckIcon size={18} /> A little presence. A lot of difference.
          </p>
          <h1>
            SomeoneNear.
            <br />
            <span>Close, even from afar.</span>
          </h1>
          <p>
            You can&apos;t always be there. A friendly call, a gentle reminder, and a family circle
            can help you stay connected.
          </p>
          <div className="care-mobile-paths">
            <Button asChild>
              <Link
                to={signedIn ? "/family" : "/auth"}
                search={signedIn ? undefined : { redirect: "/family" }}
              >
                Your family circle <ArrowRightIcon />
              </Link>
            </Button>
            <Link
              to={signedIn ? "/listeners" : "/auth"}
              search={signedIn ? undefined : { redirect: "/listeners" }}
              className="text-sm font-bold underline"
            >
              Or book a listener
            </Link>
          </div>
        </div>
        <div className="care-hero-world">
          <IllustrationGlobe />
        </div>
        <div className="care-paths">
          <div className="care-path">
            <h2>For someone you love</h2>
            <p>Bring your family together, with sharing choices that stay in their hands.</p>
            <Button asChild>
              <Link
                to={signedIn ? "/family" : "/auth"}
                search={signedIn ? undefined : { redirect: "/family" }}
              >
                Open your family circle <ArrowRightIcon />
              </Link>
            </Button>
          </div>
          <div className="care-path">
            <h2>A moment for yourself</h2>
            <p>A real listener, your private Companion, or a calmer minute. Start where you are.</p>
            <Button asChild variant="outline">
              <Link
                to={signedIn ? "/listeners" : "/auth"}
                search={signedIn ? undefined : { redirect: "/listeners" }}
              >
                <HeadphonesIcon /> Book a listener call
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="care-options px-5 pb-8" aria-label="Explore care options">
        <div className="care-filters">
          {TOPICS.map((item, index) => (
            <button key={item.label} aria-pressed={topic === index} onClick={() => setTopic(index)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="care-feature-note" aria-live="polite">
          {TOPICS[topic].text}{" "}
          <Link
            className="font-bold text-brand-accent underline"
            to={signedIn ? TOPICS[topic].to : "/auth"}
            search={signedIn ? undefined : { redirect: TOPICS[topic].to }}
          >
            Explore
          </Link>
        </p>
      </section>
    </>
  );
}
