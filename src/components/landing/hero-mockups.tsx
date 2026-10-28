import { CheckIcon, PhoneCallIcon } from "@phosphor-icons/react";

import { Orb } from "./playroom-orb";

/**
 * Flat product mockups for the two hero path cards.
 *
 * Built from DOM rather than SVG so the floating chips can be animated
 * individually by GSAP. Every chip carries `data-chip` so the idle-drift
 * timeline can pick them up without brittle selectors.
 */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[186px] rounded-[26px] border-[5px] border-ink bg-card p-2.5 shadow-soft">
      {/* Speaker notch */}
      <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-ink/15" />
      {children}
    </div>
  );
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-chip
      className={`absolute rounded-xl border border-border bg-card px-2.5 py-1.5 text-[10px] font-semibold leading-tight text-foreground shadow-gentle ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/** Card A — what the family sees after a call. */
export function DashboardMockup() {
  return (
    <div className="relative mx-auto h-[248px] w-full max-w-[320px]">
      <div className="absolute left-1/2 top-2 -translate-x-1/2">
        <PhoneFrame>
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Today
          </p>

          <div className="space-y-2 rounded-2xl bg-surface p-2.5">
            <div className="flex items-center gap-2">
              <Orb tone="saffron" face="smile" className="h-7 w-7 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold leading-tight">Mum</p>
                <p className="text-[9px] leading-tight text-muted-foreground">
                  Called 11:04 · 14 min
                </p>
              </div>
            </div>

            <p className="text-[9.5px] font-medium leading-snug text-foreground/80">
              &ldquo;Sounded bright. Been out in the garden.&rdquo;
            </p>

            <div className="space-y-1 border-t border-border pt-1.5">
              {["Ate lunch", "Took her tablets"].map((label) => (
                <p
                  key={label}
                  className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground"
                >
                  <CheckIcon className="h-2.5 w-2.5 text-orb-grass" weight="bold" />
                  {label}
                </p>
              ))}
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* Floating context, cropped deliberately so the scene feels continuous */}
      <Chip className="left-0 top-12 -rotate-6">
        <span className="flex items-center gap-1">
          <CheckIcon className="h-2.5 w-2.5 text-orb-grass" weight="bold" />
          Dose logged
        </span>
      </Chip>

      <Chip className="right-0 top-6 rotate-[5deg]">Mood · steady</Chip>

      <Chip className="bottom-5 right-1 -rotate-3">
        <span className="flex items-center gap-1">
          <Orb tone="aqua" face="plain" className="h-2.5 w-2.5" />
          3 calls this week
        </span>
      </Chip>

      <div data-chip className="absolute bottom-2 left-6">
        <Orb tone="pink" face="calm" className="h-9 w-9" />
      </div>
    </div>
  );
}

/** Card B — a listener call in progress, plus the companion. */
export function ListenerCallMockup() {
  return (
    <div className="relative mx-auto h-[248px] w-full max-w-[320px]">
      <div className="absolute left-1/2 top-2 -translate-x-1/2">
        <PhoneFrame>
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-2.5 py-4">
            <span className="rounded-full bg-orb-grass/15 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-orb-grass">
              Connected
            </span>

            <Orb tone="periwinkle" face="calm" className="h-16 w-16" />

            <div className="text-center">
              <p className="text-[11px] font-bold leading-tight">Priya</p>
              <p className="text-[9px] leading-tight text-muted-foreground">
                Your listener
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1">
              <PhoneCallIcon
                className="h-2.5 w-2.5 text-on-plate"
                weight="fill"
              />
              <span className="text-[9px] font-bold tabular-nums text-on-plate">
                08:12
              </span>
            </div>
          </div>
        </PhoneFrame>
      </div>

      <Chip className="left-0 top-8 -rotate-[7deg]">Listener call · 15 min</Chip>

      <Chip className="bottom-9 right-0 max-w-[132px] rotate-[4deg] font-medium">
        <span className="flex items-start gap-1.5">
          <Orb tone="navy" face="plain" className="mt-px h-2.5 w-2.5 shrink-0" />
          <span className="leading-snug">How are you feeling today?</span>
        </span>
      </Chip>

      <div data-chip className="absolute bottom-3 left-7">
        <Orb tone="saffron" face="wink" className="h-8 w-8" />
      </div>
    </div>
  );
}
