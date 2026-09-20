import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  ChatCircleIcon,
  FireIcon,
  HandHeartIcon,
  MoonIcon,
  SparkleIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { AppCard, AppHero, SectionHeading } from "@/components/app-page";
import { Orb, type OrbTone } from "@/components/landing/playroom-orb";
import { Button } from "@/components/ui/button";
import { useAppPageMotion } from "@/hooks/use-app-page-motion";
import { supabase } from "@/integrations/supabase/client";
import { createConversation } from "@/lib/conversations.functions";

export const Route = createFileRoute("/_authenticated/companion/")({
  component: CompanionEmpty,
});

/**
 * Openers. Each carries an orb tone rather than a gradient — the previous
 * version used hardcoded Tailwind palette gradients (from-indigo-100 etc) that
 * belonged to no design system and clashed with the brand once it changed.
 */
const PROMPTS: {
  icon: typeof MoonIcon;
  label: string;
  tone: OrbTone;
}[] = [
  { icon: MoonIcon, label: "Rough evening", tone: "navy" },
  { icon: ChatCircleIcon, label: "Vent for 2 min", tone: "terracotta" },
  { icon: HandHeartIcon, label: "Help me sleep", tone: "periwinkle" },
  { icon: SunIcon, label: "Something happy", tone: "saffron" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function CompanionEmpty() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createConversation);
  const [firstName, setFirstName] = useState<string>("friend");
  const [streak, setStreak] = useState<number>(0);
  const [moods, setMoods] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useAppPageMotion(rootRef, loaded);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const [{ data: prof }, { data: entries }] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", u.user.id).maybeSingle(),
          supabase
            .from("journal_entries")
            .select("created_at, mood")
            .eq("user_id", u.user.id)
            .order("created_at", { ascending: false })
            .limit(60),
        ]);
        if (prof?.display_name) setFirstName(prof.display_name.split(" ")[0]);
        if (entries?.length) {
          const days = new Set(entries.map((e) => new Date(e.created_at as string).toDateString()));
          let s = 0;
          const cur = new Date();
          while (days.has(cur.toDateString())) {
            s += 1;
            cur.setDate(cur.getDate() - 1);
          }
          setStreak(s);
          const map = new Map<string, number>();
          for (const e of entries) {
            const d = new Date(e.created_at as string).toDateString();
            if (!map.has(d) && typeof e.mood === "number") map.set(d, e.mood);
          }
          const series: number[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            series.push(map.get(d.toDateString()) ?? 3);
          }
          setMoods(series);
        } else {
          setMoods([3, 3, 4, 3, 4, 4, 3]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const startWith = useMutation({
    mutationFn: () => createFn(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/companion/$threadId", params: { threadId: data.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const start = () => startWith.mutate();

  // Sparkline geometry. Stroke colour now comes from a token via currentColor
  // instead of a baked orange gradient.
  const W = 320;
  const H = 80;
  const step = W / Math.max(1, moods.length - 1);
  const points = moods.map((m, i) => [i * step, H - ((m - 1) / 4) * (H - 12) - 6] as const);
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");

  return (
    <div ref={rootRef} className="flex-1 overflow-y-auto p-4 md:p-6">
      <AppHero
        eyebrow="A quiet room, whenever you need one"
        title={`${greetingText()}, ${firstName}`}
        description="Take a breath. Nothing you write here is shared, and there's no wrong way to start."
        orb="saffron"
        actions={
          <>
            <Button
              data-page-cta
              onClick={start}
              disabled={startWith.isPending}
              className="h-[52px] rounded-full px-7 text-base font-bold"
            >
              <SparkleIcon className="mr-2 h-5 w-5" />
              {startWith.isPending ? "Opening…" : "Start today's check-in"}
            </Button>
            <Button
              data-page-cta
              variant="outline"
              onClick={start}
              disabled={startWith.isPending}
              className="h-[52px] rounded-full border-2 px-7 text-base font-bold"
            >
              <ChatCircleIcon className="mr-2 h-5 w-5" /> Just talk
            </Button>
          </>
        }
      />

      {/* OPENERS */}
      <section data-page-reveal className="mt-10">
        <SectionHeading
          title="Start with a feeling"
          hint="Tap one, or write your own"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              data-page-stagger
              onClick={start}
              disabled={startWith.isPending}
              // Min-height clears the 44px target comfortably; no gradient fill.
              className="group flex min-h-[72px] items-center gap-3.5 rounded-[20px] border border-border bg-card px-4 text-left transition-all hover:-translate-y-0.5 hover:border-ink/25 disabled:opacity-60"
            >
              <Orb
                tone={p.tone}
                face="calm"
                gaze
                className="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-105"
              />
              <span className="text-base font-bold leading-tight">{p.label}</span>
              <ArrowRightIcon className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>

      {/* PROGRESS */}
      <section data-page-reveal className="mt-10">
        <SectionHeading title="How you've been" hint="Only you can see this" />
        <div className="grid gap-3 md:grid-cols-3">
          <AppCard>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-bold">Mood trend</p>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-primary">
                Last 7 days
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="mt-3 h-20 w-full text-orb-terracotta"
              role="img"
              aria-label="Your mood over the last seven days"
            >
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3.5} fill="currentColor" />
              ))}
            </svg>
            <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground">
              {DAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </AppCard>

          <AppCard>
            <p className="text-base font-bold">Check-in streak</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-orb-terracotta/12 leading-none">
                <span
                  data-page-counter={streak}
                  className="text-2xl font-extrabold tabular-nums text-orb-terracotta"
                >
                  {streak}
                </span>
                <span className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                  {streak === 1 ? "DAY" : "DAYS"}
                </span>
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-base font-bold">
                  <FireIcon className="h-4 w-4 text-orb-terracotta" weight="fill" />
                  {streak > 0 ? "Keep it warm" : "Start today"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A little every day adds up.
                </p>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <p className="text-base font-bold">Today</p>
            <div className="mt-3 flex items-center gap-4">
              <Orb tone="grass" face="smile" gaze className="h-16 w-16 shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-bold">Ready when you are</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No streak to protect, no score to keep.
                </p>
              </div>
            </div>
          </AppCard>
        </div>
      </section>

      <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted-foreground">
        Not therapy or an emergency service. In a crisis, call 988 (US) or your local
        helpline.
      </p>
    </div>
  );
}
