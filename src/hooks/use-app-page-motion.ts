import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";

/**
 * Shared motion for authenticated app pages.
 *
 * One hook for every in-app screen so they all arrive the same way, rather than
 * each page inventing its own entrance. Deliberately restrained: a single
 * orchestrated entrance, then one-time scroll reveals, then stillness. Nothing
 * loops. These are screens people open daily, and ambient motion that delights
 * on the first visit is an irritant by the fiftieth.
 *
 * Opt in from markup with these attributes:
 *   data-page-eyebrow   small label above the title
 *   data-page-headline  the h1 with a simple browser-safe reveal
 *   data-page-sub       supporting copy
 *   data-page-cta       action buttons
 *   data-page-reveal    a block that fades up once when scrolled to
 *   data-page-stagger   grid children that arrive as a run
 *   data-page-counter   numeric value to count up to
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

const SEL = {
  eyebrow: "[data-page-eyebrow]",
  headline: "[data-page-headline]",
  sub: "[data-page-sub]",
  cta: "[data-page-cta]",
  reveal: "[data-page-reveal]",
  stagger: "[data-page-stagger]",
  counter: "[data-page-counter]",
} as const;

export function useAppPageMotion(
  root: RefObject<HTMLElement | null>,
  /** Hold the entrance until data has landed, so counters have real targets. */
  ready: boolean = true,
) {
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !ready) return;

      const q = gsap.utils.selector(scope);
      const mm = gsap.matchMedia();

      const writeCounters = () => {
        q(SEL.counter).forEach((el) => {
          const raw = el.getAttribute("data-page-counter");
          if (raw) el.textContent = Number(raw).toLocaleString();
        });
      };

      /* -- Reduced motion: final states, no timelines --------------------- */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          [
            q(SEL.eyebrow),
            q(SEL.sub),
            q(SEL.cta),
            q(SEL.reveal),
            q(SEL.stagger),
          ].flat(),
          { autoAlpha: 1, y: 0, clearProps: "transform" },
        );
        writeCounters();
      });

      /* -- Full motion ---------------------------------------------------- */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const eyebrow = q(SEL.eyebrow);
        const headline = q(SEL.headline);
        const sub = q(SEL.sub);
        const cta = q(SEL.cta);
        const intro = [eyebrow, sub, cta].flat();
        if (intro.length) gsap.set(intro, { autoAlpha: 0, y: 12 });
        if (headline.length) gsap.set(headline, { autoAlpha: 0, y: 18 });

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        if (eyebrow.length) tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.35 });
        if (headline.length) {
          tl.to(headline, { autoAlpha: 1, y: 0, duration: 0.65, ease: "expo.out" }, "-=0.18");
        }
        if (sub.length) tl.to(sub, { autoAlpha: 1, y: 0, duration: 0.4 }, "-=0.42");
        if (cta.length) {
          tl.to(cta, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06 }, "-=0.28");
        }

        /* -- Count-ups --------------------------------------------------- */
        q(SEL.counter).forEach((el) => {
          const target = Number(el.getAttribute("data-page-counter") ?? "0");
          if (!Number.isFinite(target) || target === 0) {
            el.textContent = String(target || 0);
            return;
          }
          const obj = { v: 0 };
          el.textContent = "0";
          gsap.to(obj, {
            v: target,
            duration: 1,
            delay: 0.4,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = Math.round(obj.v).toLocaleString();
            },
          });
        });

        /* -- One-time scroll reveals ------------------------------------- */
        const reveals = q(SEL.reveal);
        if (reveals.length) {
          gsap.set(reveals, { autoAlpha: 0, y: 18 });
          ScrollTrigger.batch(reveals, {
            start: "top 93%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.5,
                ease: "power3.out",
                stagger: 0.07,
                overwrite: true,
              }),
          });
        }

        const staggered = q(SEL.stagger);
        if (staggered.length) {
          gsap.set(staggered, { autoAlpha: 0, y: 14 });
          ScrollTrigger.batch(staggered, {
            start: "top 95%",
            once: true,
            batchMax: 6,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.42,
                ease: "power3.out",
                stagger: 0.05,
                overwrite: true,
              }),
          });
        }

        return () => tl.revert();
      });

      return () => mm.revert();
    },
    { dependencies: [ready], scope: root, revertOnUpdate: true },
  );
}
