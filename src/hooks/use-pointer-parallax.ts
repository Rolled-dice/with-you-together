import { useEffect } from "react";

/**
 * Pointer-driven parallax. Reads mouse position, normalizes to [-1, 1],
 * and sets CSS variables `--px` and `--py` on any element with
 * `data-parallax`. Cheap and rAF-throttled.
 */
export function usePointerParallax() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      raf = 0;
      const nodes = document.querySelectorAll<HTMLElement>("[data-parallax]");
      for (const n of nodes) {
        n.style.setProperty("--px", px.toFixed(3));
        n.style.setProperty("--py", py.toFixed(3));
      }
    };

    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      px = (e.clientX / w) * 2 - 1;
      py = (e.clientY / h) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
