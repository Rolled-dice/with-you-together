import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type { RefObject } from "react";

/**
 * Motion for the authenticated dashboard.
 *
 * Deliberately quieter than the marketing page: this is a screen someone opens
 * every day, so one short entrance and then stillness. Nothing loops, nothing
 * moves on scroll after it has arrived — ambient motion that is charming once
 * becomes irritating on the fiftieth visit.
 *
 * Mirrors the landing page's easing vocabulary (expo/power3, no bounce) so the
 * app doesn't feel like a different product after sign-in.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

const SEL = {
  greetPill: "[data-dash-pill]",
  headline: "[data-dash-headline]",
  sub: "[data-dash-sub]",
  cta: "[data-dash-cta]",
  orb: "[data-dash-orb]",
  stat: "[data-dash-stat]",
  counter: "[data-dash-counter]",
  section: "[data-dash-section]",
  tile: "[data-dash-tile]",
  badge: "[data-dash-badge]",
} as const;

export function useDashboardMotion(
  root: RefObject<HTMLElement | null>,
  /** Re-run once data has loaded, so counters animate to real values. */
  ready: boolean,
) {
  useGSAP(
    () => {
      const scope = root.current;
      if (!scope || !ready) return;

      const q = gsap.utils.selector(scope);
      const mm = gsap.matchMedia();

      /* ---------------- Reduced motion: no timelines at all -------------- */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          [
            q(SEL.greetPill),
            q(SEL.sub),
            q(SEL.cta),
            q(SEL.stat),
            q(SEL.section),
            q(SEL.tile),
            q(SEL.badge),
          ].flat(),
          { autoAlpha: 1, y: 0, scale: 1, clearProps: "transform" },
        );
        // Counters still need their final text, just without counting.
        q(SEL.counter).forEach((el) => {
          const target = el.getAttribute("data-dash-counter");
          if (target) el.textContent = Number(target).toLocaleString();
        });
      });

      /* ---------------- Full motion -------------------------------------- */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const headline = q(SEL.headline)[0];

        // Hide what the entrance will bring in, before first paint.
        gsap.set([q(SEL.greetPill), q(SEL.sub), q(SEL.cta)].flat(), {
          autoAlpha: 0,
          y: 14,
        });
        gsap.set(q(SEL.stat), { autoAlpha: 0, y: 18 });
        gsap.set(q(SEL.orb), { autoAlpha: 0, scale: 0.6 });

        let split: SplitText | null = null;

        const build = (lines: Element[]) => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

          tl.to(q(SEL.greetPill), { autoAlpha: 1, y: 0, duration: 0.4 })
            .from(lines, {
              yPercent: 110,
              duration: 0.85,
              ease: "expo.out",
              stagger: 0.07,
            }, "-=0.2")
            .to(q(SEL.sub), { autoAlpha: 1, y: 0, duration: 0.45 }, "-=0.45")
            .to(q(SEL.cta), { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.07 }, "-=0.3")
            .to(
              q(SEL.orb),
              { autoAlpha: 1, scale: 1, duration: 0.6, ease: "power2.out", stagger: 0.08 },
              "-=0.6",
            )
            .to(
              q(SEL.stat),
              { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06 },
              "-=0.35",
            );

          return tl;
        };

        if (headline) {
          // autoSplit re-runs if the webfont lands late, which is exactly when
          // line splits break.
          split = SplitText.create(headline, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) => build(self.lines),
          });
        } else {
          build([]);
        }

        /* -- Count up the real numbers ----------------------------------- */
        q(SEL.counter).forEach((el) => {
          const target = Number(el.getAttribute("data-dash-counter") ?? "0");
          if (!Number.isFinite(target)) return;
          if (target === 0) {
            el.textContent = "0";
            return;
          }
          const obj = { v: 0 };
          el.textContent = "0";
          gsap.to(obj, {
            v: target,
            duration: 1.1,
            delay: 0.5,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = Math.round(obj.v).toLocaleString();
            },
          });
        });

        /* -- Sections below the fold arrive once, then stay still --------- */
        const sections = q(SEL.section);
        if (sections.length) {
          gsap.set(sections, { autoAlpha: 0, y: 20 });
          ScrollTrigger.batch(sections, {
            start: "top 92%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.55,
                ease: "power3.out",
                stagger: 0.08,
                overwrite: true,
              }),
          });
        }

        const tiles = q(SEL.tile);
        if (tiles.length) {
          gsap.set(tiles, { autoAlpha: 0, y: 16 });
          ScrollTrigger.batch(tiles, {
            start: "top 94%",
            once: true,
            batchMax: 4,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.45,
                ease: "power3.out",
                stagger: 0.05,
                overwrite: true,
              }),
          });
        }

        const badges = q(SEL.badge);
        if (badges.length) {
          gsap.set(badges, { autoAlpha: 0, scale: 0.92 });
          ScrollTrigger.batch(badges, {
            start: "top 95%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                scale: 1,
                duration: 0.4,
                ease: "power2.out",
                stagger: 0.05,
                overwrite: true,
              }),
          });
        }

        return () => split?.revert();
      });

      return () => mm.revert();
    },
    { dependencies: [ready], scope: root, revertOnUpdate: true },
  );
}
