import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useRef } from "react";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, SplitText);

/**
 * Rotating hero headline, in the Headspace mould:
 *
 *   [ Sleep better ]   all with SomeoneNear
 *   [ Feel less anxious ]   all with SomeoneNear
 *   ...
 *
 * The bracketed phrase cycles through PHRASES. On each change the outgoing
 * phrase's characters fall away and the incoming phrase's characters rise up
 * from below one by one — the "comes from the bottom to up" effect requested.
 * "all with SomeoneNear" is fixed and never animates.
 */

const PHRASES = [
  "Sleep better",
  "Feel less anxious",
  "Improve relationships",
  "Find your calm",
  "Worry less",
] as const;

const HOLD = 2.4; // seconds a phrase stays before rotating

export function RotatingHeadline() {
  const slotRef = useRef<HTMLSpanElement>(null);
  // Measures the widest phrase so the bracket doesn't jump width as phrases
  // swap. Rendered invisibly, one per phrase, stacked; the tallest/widest wins.
  const sizerRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    (_ctx, contextSafe) => {
      const slot = slotRef.current;
      if (!slot) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Reduced motion: just show the first phrase, no cycling.
      if (reduce) {
        slot.textContent = PHRASES[0];
        return;
      }

      let index = 0;
      let split: SplitText | null = null;
      let cycle: gsap.core.Timeline | null = null;

      const setPhrase = contextSafe?.((text: string, animateIn: boolean) => {
        split?.revert();
        slot.textContent = text;
        split = SplitText.create(slot, { type: "chars", aria: "none" });
        if (animateIn) {
          gsap.from(split.chars, {
            yPercent: 120,
            autoAlpha: 0,
            duration: 0.55,
            ease: "back.out(1.6)",
            stagger: 0.03,
          });
        }
      });

      // Prime the first phrase with an intro rise.
      setPhrase?.(PHRASES[0], true);

      const advance = contextSafe?.(() => {
        const outgoing = split?.chars ?? [];
        cycle = gsap.timeline();
        cycle
          // Outgoing characters drop and fade.
          .to(outgoing, {
            yPercent: -120,
            autoAlpha: 0,
            duration: 0.4,
            ease: "power2.in",
            stagger: 0.02,
          })
          .add(() => {
            index = (index + 1) % PHRASES.length;
            setPhrase?.(PHRASES[index], true);
          });
      });

      // A repeating driver: hold, advance, repeat.
      const loop = gsap.timeline({ repeat: -1, repeatDelay: HOLD });
      loop.to({}, { duration: HOLD }).add(() => advance?.());

      return () => {
        loop.kill();
        cycle?.kill();
        split?.revert();
      };
    },
    { scope: slotRef },
  );

  return (
    <span className="flex flex-col items-center gap-2 sm:gap-3">
      {/* The rotating phrase, wrapped in brackets. inline-grid stacks an
          invisible sizer under the live slot so the bracket holds the width of
          the longest phrase and never reflows mid-animation. */}
      <span className="inline-grid text-orb-terracotta">
        <span
          aria-hidden
          ref={sizerRef}
          className="invisible col-start-1 row-start-1 whitespace-nowrap"
        >
          {/* Longest phrase reserves the space. */}
          Improve relationships
        </span>
        <span className="col-start-1 row-start-1 inline-flex items-baseline justify-center gap-1 whitespace-nowrap">
          <span aria-hidden className="text-foreground/40">
            [
          </span>
          {/* overflow-hidden clips characters as they rise/fall past the edge */}
          <span className="overflow-hidden pb-[0.12em]">
            <span
              ref={slotRef}
              className="inline-block"
              // Screen readers get a stable label; the visual cycles.
              aria-label="Sleep better, feel less anxious, improve relationships, or find your calm"
            >
              Sleep better
            </span>
          </span>
          <span aria-hidden className="text-foreground/40">
            ]
          </span>
        </span>
      </span>

      <span className="text-foreground">all with SomeoneNear</span>
    </span>
  );
}
