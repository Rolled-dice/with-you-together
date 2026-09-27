import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * Landing-page entry point for the public Calm space (/calm).
 *
 * The rest of the landing page speaks to carers looking after a distant parent.
 * This piece speaks to the *visitor themselves* - someone who is stressed or
 * lonely right now - and pulls them into the free, no-sign-up calm space.
 *
 * All motion is gentle and honours prefers-reduced-motion (a static orb).
 * Everything is client-only tokens/markup, safe on the Cloudflare Worker.
 */

/** A small navy orb that slowly breathes, used as the eye-catch in the band. */
function BreathingPreview() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
      <span aria-hidden className="absolute inset-0 rounded-full border border-background/30" />
      <span aria-hidden className="absolute inset-3 rounded-full border border-background/25" />
      {reduceMotion ? (
        <span
          aria-hidden
          className="h-[58%] w-[58%] rounded-full bg-gradient-to-br from-background/95 to-background/70"
        />
      ) : (
        <motion.span
          aria-hidden
          className="rounded-full bg-gradient-to-br from-background to-background/75 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.35)]"
          style={{ width: "58%", height: "58%" }}
          animate={{ scale: [0.7, 1, 1, 0.7] }}
          transition={{ duration: 10, times: [0, 0.4, 0.5, 1], repeat: Infinity, ease: [0.37, 0, 0.63, 1] }}
        />
      )}
    </div>
  );
}

/**
 * Full-width periwinkle band that reframes the page for the second audience and
 * is built to stop the scroll: a breathing preview beside a clear, free CTA.
 */
export function CalmBand() {
  return (
    <section className="px-6 py-10">
      <div
        data-reveal
        className="mx-auto flex w-full max-w-6xl flex-col items-center gap-7 rounded-[32px] bg-plate-periwinkle px-7 py-10 text-background sm:px-12 md:flex-row md:justify-between md:py-12"
      >
        <div className="text-center md:text-left">
          <p className="text-sm font-bold uppercase tracking-wide text-background/80">A minute for you</p>
          <h2 className="mx-auto mt-1.5 max-w-md text-2xl leading-tight sm:text-3xl md:mx-0">
            Not here for someone else? This one&apos;s for you.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[0.975rem] leading-relaxed text-background/85 md:mx-0">
            Breathe along with a slow circle, or name a worry and watch it float away. No sign-up,
            nothing saved - just a quiet minute whenever a day feels heavy.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row md:items-start">
            <Button
              asChild
              size="lg"
              data-magnetic
              className="rounded-full bg-background px-7 text-base font-bold text-brand-primary hover:bg-background/90"
            >
              <Link to="/calm">
                Try the calm space
                <ArrowRightIcon className="ml-1.5 h-4 w-4" weight="bold" />
              </Link>
            </Button>
            <span className="text-xs font-semibold text-background/75">Free · no sign-up</span>
          </div>
        </div>

        <div className="shrink-0">
          <BreathingPreview />
        </div>
      </div>
    </section>
  );
}
