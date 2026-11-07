import { useEffect, useRef, useState } from "react";

/**
 * SomeoneNear signature cursor.
 * - Coral dot tracks pointer 1:1.
 * - Peach ring eases behind with spring-like damping.
 * - Ring expands over interactive elements, pulses on press.
 * - Desktop + fine pointer + no reduced-motion only (CSS gate on .someonenear-cursor).
 * - Native OS cursor stays visible for accessibility.
 */
export function SomeoneNearCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    let raf = 0;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    const loop = () => {
      // ease the ring toward the pointer
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(var(--w-scale, 1))`;
      }
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const setScale = (v: number) => {
      ringRef.current?.style.setProperty("--w-scale", String(v));
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const interactive = t.closest(
        "a, button, [role='button'], [role='link'], input[type='button'], input[type='submit'], summary",
      );
      const textInput = t.closest("input:not([type='button']):not([type='submit']), textarea, [contenteditable='true']");
      if (interactive) {
        setScale(2.2);
        ringRef.current?.classList.add("wcursor-ring--hot");
      } else if (textInput) {
        setScale(0.8);
        ringRef.current?.classList.add("wcursor-ring--text");
      } else {
        setScale(1);
        ringRef.current?.classList.remove("wcursor-ring--hot", "wcursor-ring--text");
      }
    };

    const onDown = () => ringRef.current?.classList.add("wcursor-ring--press");
    const onUp = () => ringRef.current?.classList.remove("wcursor-ring--press");

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <style>{`
        .wcursor-root { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
        .wcursor-dot { position: fixed; top: 0; left: 0; width: 8px; height: 8px; border-radius: 999px;
          background: oklch(0.72 0.16 30); mix-blend-mode: multiply; will-change: transform; }
        .wcursor-ring { position: fixed; top: 0; left: 0; width: 36px; height: 36px; border-radius: 999px;
          border: 1.5px solid oklch(0.72 0.16 30 / 0.65); background: oklch(0.72 0.16 30 / 0.06);
          transition: background 180ms ease, border-color 180ms ease, border-radius 180ms ease, --w-scale 200ms ease;
          will-change: transform; }
        .wcursor-ring--hot { background: oklch(0.72 0.16 30 / 0.14); border-color: oklch(0.72 0.16 30 / 0.85); }
        .wcursor-ring--text { border-radius: 6px; border-color: oklch(0.72 0.16 30 / 0.9); background: transparent; }
        .wcursor-ring--press { animation: wcursor-pop 260ms ease-out; }
        @keyframes wcursor-pop { 0% { transform: translate3d(var(--_x,0), var(--_y,0), 0) scale(0.85); } 100% { transform: translate3d(var(--_x,0), var(--_y,0), 0) scale(1); } }
      `}</style>
      <div className="someonenear-cursor wcursor-root" aria-hidden>
        <div ref={ringRef} className="wcursor-ring" />
        <div ref={dotRef} className="wcursor-dot" />
      </div>
    </>
  );
}
