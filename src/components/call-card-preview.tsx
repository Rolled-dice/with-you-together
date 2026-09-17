import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * A calm, non-technical preview of what a listener call feels like.
 * Purely presentational: no real call is placed. Borrows the status-pill
 * and live-dot visual grammar from the authenticated call room, softened
 * for the marketing page (warm clay tones, no raw connection strings).
 */
export function CallCardPreview({ className }: { className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => (s >= 154 ? 0 : s + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          fullMotion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion: boolean };
          if (reduceMotion || !dotRef.current) return;
          gsap.to(dotRef.current, {
            scale: 1.5,
            opacity: 0.35,
            duration: 1.8,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            transformOrigin: "50% 50%",
          });
        },
      );
      return () => mm.revert();
    },
    { scope },
  );

  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const elapsed = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <div
      ref={scope}
      className={cn("rounded-3xl border border-primary/25 bg-surface p-6 shadow-gentle", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-medium text-primary">
          <span className="relative inline-flex h-2 w-2">
            <span ref={dotRef} className="absolute inset-0 rounded-full bg-primary" aria-hidden />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Connected
        </span>
        <span className="font-display text-sm text-muted-foreground">{elapsed}</span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Mic className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-medium text-foreground">Your listener</p>
          <p className="text-sm text-muted-foreground">
            Audio only · rings your phone, nothing to install
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
          tabIndex={-1}
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
          tabIndex={-1}
        >
          <PhoneOff className="h-4 w-4" />
        </button>
        <p className="text-xs text-muted-foreground">A preview, not a live call</p>
      </div>
    </div>
  );
}
