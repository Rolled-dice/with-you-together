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

      const setPhrase = contextSafe?.((text: string, animateIn: boolean) => {
        split?.revert();
        slot.textContent = text;
        split = SplitText.create(slot, { type: "chars", aria: "none" });
        if (animateIn) {
          // Straight rise from below, one character at a time. No overshoot,
          // no fade tricks — just up.
          gsap.from(split.chars, {
            yPercent: 100,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.03,
          });
        }
      });

      // Prime the first phrase with an intro rise.
      setPhrase?.(PHRASES[0], true);

      const advance = contextSafe?.(() => {
        // No exit animation — the outgoing phrase is simply replaced, and the
        // incoming one rises up into its place.
        index = (index + 1) % PHRASES.length;
        setPhrase?.(PHRASES[index], true);
      });

      // A repeating driver: hold, advance, repeat.
      const loop = gsap.timeline({ repeat: -1 });
      loop.to({}, { duration: HOLD }).add(() => advance?.());

      return () => {
        loop.kill();
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
        <span className="col-start-1 row-start-1 flex justify-center whitespace-nowrap">
          {/* overflow-hidden clips characters as they rise up past the edge */}
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
        </span>
      </span>

      <span className="text-foreground">all with SomeoneNear</span>
    </span>
  );
}
