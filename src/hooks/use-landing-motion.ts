import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type { RefObject } from "react";

/**
 * Motion layer for the landing page.
 *
 * One orchestrated page-load sequence (headline -> proof row -> path cards ->
 * mockup chips), then quiet scroll reveals. Everything is scoped to `root` so
 * selectors can't leak, and every effect is created inside `gsap.matchMedia()`
 * so the reduced-motion branch is a genuine alternative rather than a
 * near-instant replay of the same tweens.
 *
 * Plugins are registered at module scope but guarded for SSR — this module is
 * only imported by a client component tree, and the guard keeps it safe if that
 * ever changes.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

/** Selector contract shared with the markup. */
const SEL = {
  headline: "[data-hero-headline]",
  proof: "[data-hero-proof]",
  card: "[data-hero-card]",
  chip: "[data-chip]",
  reveal: "[data-reveal]",
  stagger: "[data-reveal-stagger]",
  marquee: "[data-marquee-track]",
  marqueePause: "[data-marquee-pause]",
  marqueeIcon: "[data-marquee-icon]",
  marqueeShine: "[data-marquee-shine]",
  magnetic: "[data-magnetic]",
  drift: "[data-drift]",
  counter: "[data-counter]",
} as const;

export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  useGSAP(
    (_context, contextSafe) => {
      const scope = root.current;
      if (!scope) return;

      const q = gsap.utils.selector(scope);
      const mm = gsap.matchMedia();

      /* ------------------------------------------------------------------ *
       * Reduced motion: land everything in its final state, no timelines.
       * ------------------------------------------------------------------ */
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          [
            q(SEL.proof),
            q(SEL.card),
            q(SEL.chip),
            q(SEL.reveal),
            q(SEL.stagger),
          ].flat(),
          { autoAlpha: 1, y: 0, scale: 1, rotate: 0, clearProps: "transform" },
        );
      });

      /* ------------------------------------------------------------------ *
       * Full motion.
       * ------------------------------------------------------------------ */
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cleanups: Array<() => void> = [];

        // -- 1. The one orchestrated page-load moment -------------------
        const headline = q(SEL.headline)[0];

        // Hide the pieces that the entrance timeline will bring in, before
        // first paint (useGSAP runs in a layout effect).
        gsap.set([q(SEL.proof), q(SEL.card)].flat(), { autoAlpha: 0, y: 26 });
        gsap.set(q(SEL.chip), { autoAlpha: 0, y: 14, scale: 0.94 });

        const buildEntrance = (lines: Element[]) => {
          const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

          tl.from(lines, {
            yPercent: 115,
            duration: 1.05,
            stagger: 0.09,
          })
            .to(
              q(SEL.proof),
              { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" },
              "-=0.62",
            )
            .to(
              q(SEL.card),
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                ease: "power3.out",
                stagger: 0.12,
              },
              "-=0.4",
            )
            .to(
              q(SEL.chip),
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.5,
                ease: "power2.out",
                stagger: 0.05,
              },
              "-=0.42",
            );

          return tl;
        };

        let split: SplitText | null = null;

        if (headline) {
          // autoSplit + onSplit re-runs the entrance if the webfont lands late
          // or the headline rewraps, which is exactly when line splits break.
          split = SplitText.create(headline, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) => buildEntrance(self.lines),
          });
        } else {
          buildEntrance([]);
        }

        cleanups.push(() => split?.revert());

        // -- 2. Idle drift on the mockup chips and background orbs -------
        // Desynchronised so the scene breathes instead of pulsing in unison.
        const drifters = [q(SEL.chip), q(SEL.drift)].flat();
        drifters.forEach((el, i) => {
          gsap.to(el, {
            y: i % 2 === 0 ? -7 : 6,
            x: i % 3 === 0 ? 4 : -3,
            duration: gsap.utils.random(8, 13),
            delay: i * 0.25,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });
        });

        // -- 3. Scroll reveals ------------------------------------------
        // Whole-section reveals, created in page order so refresh order is
        // top-to-bottom without needing refreshPriority.
        const sections = q(SEL.reveal);
        if (sections.length) {
          gsap.set(sections, { autoAlpha: 0, y: 22 });
          ScrollTrigger.batch(sections, {
            start: "top 86%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.6,
                ease: "power3.out",
                stagger: 0.09,
                overwrite: true,
              }),
          });
        }

        // Grid children that should arrive as a run rather than a block.
        const staggered = q(SEL.stagger);
        if (staggered.length) {
          gsap.set(staggered, { autoAlpha: 0, y: 18 });
          ScrollTrigger.batch(staggered, {
            start: "top 90%",
            once: true,
            batchMax: 6,
            interval: 0.1,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.5,
                ease: "power3.out",
                stagger: 0.06,
                overwrite: true,
              }),
          });
        }

        // -- 4. Live stat counters --------------------------------------
        q(SEL.counter).forEach((el) => {
          const target = Number(el.getAttribute("data-counter") ?? "0");
          if (!Number.isFinite(target) || target <= 0) return;

          // The markup ships the real figure for SSR and no-JS readers; zero it
          // here (while still below the fold) so the count-up has somewhere to
          // travel from without visibly snapping backwards.
          el.textContent = "0";

          const obj = { value: 0 };
          gsap.to(obj, {
            value: target,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onUpdate: () => {
              el.textContent = Math.round(obj.value).toLocaleString();
            },
          });
        });

        // -- 5. Marquee -------------------------------------------------
        // The track renders its content twice, so -50% is a seamless loop.
        // Three layered motions make the ribbon read as "alive" rather than
        // a flat slide: the scroll itself, an independent bob on each orb
        // icon, and a soft diagonal shine sweeping over the whole strip.
        q(SEL.marquee).forEach((track) => {
          const scrollTween = gsap.to(track, {
            xPercent: -50,
            duration: 18,
            ease: "none",
            repeat: -1,
          });

          // Hover/focus pauses the scroll -- turns decoration into something
          // that visibly responds to the visitor, without stopping the page.
          const pauseRoot = track.closest(SEL.marqueePause) ?? track;
          const pause = () => scrollTween.pause();
          const resume = () => scrollTween.play();
          pauseRoot.addEventListener("pointerenter", pause);
          pauseRoot.addEventListener("pointerleave", resume);
          pauseRoot.addEventListener("focusin", pause);
          pauseRoot.addEventListener("focusout", resume);
          cleanups.push(() => {
            pauseRoot.removeEventListener("pointerenter", pause);
            pauseRoot.removeEventListener("pointerleave", resume);
            pauseRoot.removeEventListener("focusin", pause);
            pauseRoot.removeEventListener("focusout", resume);
          });
        });

        // Each orb icon bobs and gently scales on its own desynced timeline,
        // independent of the scroll -- a second, slower layer of motion.
        q(SEL.marqueeIcon).forEach((icon, i) => {
          gsap.to(icon, {
            y: -3,
            scale: 1.15,
            duration: 1.1,
            delay: (i % 6) * 0.15,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });

        // A soft light sweep drifts across the ribbon -- the eye-magnet pass,
        // reusing the shimmer technique (background-position sweep) as a
        // highlight rather than a loading cue. One loop for the whole strip.
        q(SEL.marqueeShine).forEach((shine) => {
          gsap.to(shine, {
            backgroundPosition: "200% 0",
            duration: 3.2,
            repeat: -1,
            ease: "sine.inOut",
          });
        });

        // -- 6. Magnetic primary CTAs -----------------------------------
        // Pointer-driven, so the handlers must be contextSafe to be reverted.
        const fine = window.matchMedia("(pointer: fine)").matches;
        if (fine && contextSafe) {
          q(SEL.magnetic).forEach((el) => {
            const xTo = gsap.quickTo(el, "x", {
              duration: 0.4,
              ease: "power3.out",
            });
            const yTo = gsap.quickTo(el, "y", {
              duration: 0.4,
              ease: "power3.out",
            });

            const onMove = contextSafe((event: Event) => {
              const e = event as PointerEvent;
              const r = el.getBoundingClientRect();
              const dx = e.clientX - (r.left + r.width / 2);
              const dy = e.clientY - (r.top + r.height / 2);
              xTo(gsap.utils.clamp(-7, 7, dx * 0.32));
              yTo(gsap.utils.clamp(-7, 7, dy * 0.4));
            });

            const onLeave = contextSafe(() => {
              xTo(0);
              yTo(0);
            });

            el.addEventListener("pointermove", onMove);
            el.addEventListener("pointerleave", onLeave);
            cleanups.push(() => {
              el.removeEventListener("pointermove", onMove);
              el.removeEventListener("pointerleave", onLeave);
            });
          });
        }

        return () => cleanups.forEach((fn) => fn());
      });

      return () => mm.revert();
    },
    { scope: root },
  );
}
