import { useEffect } from "react";

/**
 * Global card-level pointer interactions.
 *
 * - `[data-tilt]`: sets --tilt-x / --tilt-y (deg) on hover, based on pointer
 *   position relative to the element. Pair with the `card-tilt` utility.
 * - `[data-glow]`: sets --mx / --my (%) tracking the cursor inside the card.
 *   Pair with the `card-glow` utility for a radial highlight that follows.
 * - `[data-magnetic]`: nudges the element toward the pointer while hovered.
 *
 * All effects are gated to fine pointers with no reduced-motion preference so
 * mobile layouts stay perfectly stable.
 */
export function useCardInteractions() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const active = new WeakMap<HTMLElement, { raf: number }>();

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tilt = target.closest<HTMLElement>("[data-tilt]");
      const glow = target.closest<HTMLElement>("[data-glow], .card-lift, .card-hover");
      const magnetic = target.closest<HTMLElement>("[data-magnetic]");

      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        const strength = Number(tilt.dataset.tilt) || 6;
        tilt.style.setProperty("--tilt-x", `${(-ny * strength).toFixed(2)}deg`);
        tilt.style.setProperty("--tilt-y", `${(nx * strength).toFixed(2)}deg`);
      }
      if (glow) {
        const r = glow.getBoundingClientRect();
        glow.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        glow.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      }
      if (magnetic) {
        const r = magnetic.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        const strength = Number(magnetic.dataset.magnetic) || 8;
        magnetic.style.setProperty("--mag-x", `${(nx * strength).toFixed(2)}px`);
        magnetic.style.setProperty("--mag-y", `${(ny * strength).toFixed(2)}px`);
      }
    };

    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.style.setProperty("--mag-x", "0px");
      el.style.setProperty("--mag-y", "0px");
      active.delete(el);
    };

    const onOut = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      reset(target.closest<HTMLElement>("[data-tilt]"));
      reset(target.closest<HTMLElement>("[data-magnetic]"));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
    };
  }, []);
}
