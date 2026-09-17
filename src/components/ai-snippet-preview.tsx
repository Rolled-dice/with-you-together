import { useRef } from "react";
import { MessageCircleHeart } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const lines: { from: "user" | "companion"; text: string }[] = [
  { from: "user", text: "Can't sleep again." },
  { from: "companion", text: "That's okay. No need to explain why. Want to just talk for a bit?" },
  { from: "user", text: "Yeah. Just talk." },
];

/**
 * A calm, three-line preview of what the AI companion sounds like.
 * Copy matches the existing SomeoneNear voice: plain, warm, no hype.
 */
export function AiSnippetPreview({ className }: { className?: string }) {
  const scope = useRef<HTMLDivElement>(null);

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
          const items = scope.current?.querySelectorAll("[data-line]");
          if (!items?.length) return;
          if (reduceMotion) {
            gsap.set(items, { opacity: 1, y: 0 });
            return;
          }
          gsap.from(items, {
            opacity: 0,
            y: 10,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.18,
            scrollTrigger: {
              trigger: scope.current,
              start: "top 85%",
              once: true,
            },
          });
        },
      );
      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      className={cn("rounded-3xl border border-border bg-surface p-6 shadow-gentle", className)}
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <MessageCircleHeart className="h-4 w-4" />
        </span>
        <p className="font-display text-sm font-medium text-foreground">Your companion</p>
      </div>
      <div className="mt-5 space-y-2.5">
        {lines.map((line, i) => (
          <div
            key={i}
            data-line
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              line.from === "user"
                ? "ml-auto bg-primary/12 text-foreground"
                : "bg-card text-muted-foreground",
            )}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
