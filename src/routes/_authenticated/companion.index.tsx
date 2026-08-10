import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  HeartHandshake,
  MessageCircle,
  Moon,
  Sun,
  Sparkles,
  Bot,
  Flame,
  Star,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createConversation } from "@/lib/conversations.functions";
import heroMug from "@/assets/checkin-hero.png";
import bloomOrb from "@/assets/bloom-orb.png";

export const Route = createFileRoute("/_authenticated/companion/")({
  component: CompanionEmpty,
});

const PROMPTS = [
  { icon: Moon, label: "Rough evening", tone: "from-indigo-100 to-rose-100" },
  { icon: MessageCircle, label: "Vent for 2 min", tone: "from-amber-100 to-orange-100" },
  { icon: HeartHandshake, label: "Help me sleep", tone: "from-violet-100 to-pink-100" },
  { icon: Sun, label: "Something happy", tone: "from-yellow-100 to-amber-100" },
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
          // build last-7-days mood series (1..5)
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

  // Sparkline path
  const W = 320;
  const H = 80;
  const step = W / Math.max(1, moods.length - 1);
  const points = moods.map((m, i) => [i * step, H - ((m - 1) / 4) * (H - 12) - 6] as const);
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");

  return (
    <div className="relative flex-1 overflow-y-auto p-4 md:p-6 animate-fade-up">
      {/* Warm gradient wash */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 0%, #ffe1c9 0%, transparent 60%), radial-gradient(50% 60% at 100% 20%, #ffd8b6 0%, transparent 55%), linear-gradient(180deg, #fff6ec, #fff)",
        }} />

      {/* Greeting */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
          A quiet room, whenever you need one
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {greetingText()}, {firstName} <span className="inline-block animate-heartbeat">☀️</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Take a deep breath — you're doing great. A fresh check-in is a step toward peace.
        </p>
      </div>

      {/* Top row: Today's check-in + Wellness card */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl p-5 shadow-soft card-lift animate-slide-in-up"
          style={{ background: "linear-gradient(135deg, #ffd9b9 0%, #ffb28a 100%)" }}>
          <div className="max-w-[55%]">
            <h2 className="text-xl font-bold text-neutral-900">Today's Check-in</h2>
            <p className="mt-2 text-sm text-neutral-800/80">
              A few minutes for you can make a big difference.
            </p>
            <button
              type="button"
              onClick={() => startWith.mutate()}
              disabled={startWith.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <Sparkles className="h-4 w-4 text-brand-accent" />
              Start check-in
            </button>
          </div>
          <img
            src={heroMug}
            alt=""
            className="pointer-events-none absolute -right-4 bottom-0 h-40 w-auto object-contain md:h-48"
          />
        </div>

        <div className="relative overflow-hidden rounded-3xl p-5 shadow-soft card-lift animate-slide-in-up stagger-2"
          style={{ background: "linear-gradient(135deg, #fff2e0 0%, #ffd8b6 100%)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Friendly wellness
          </p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">Say hi to your Companion</h3>
          <p className="mt-1 text-sm text-neutral-800/75">
            Nothing you write is shared. Soft, patient, no judgement.
          </p>
          <button
            type="button"
            onClick={() => startWith.mutate()}
            disabled={startWith.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #ff8a65, #e85d3a)" }}
          >
            <Bot className="h-4 w-4" /> Start AI Check-in
          </button>
          <img
            src={bloomOrb}
            alt=""
            className="pointer-events-none absolute -right-2 -bottom-2 h-32 w-32 object-contain opacity-90"
          />
        </div>
      </div>

      {/* Quick Access */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Quick Access
        </h3>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => startWith.mutate()}
            className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-4 text-left shadow-soft card-tilt card-lift animate-pop-in"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full text-white shadow-glow"
                style={{ background: "linear-gradient(135deg, #a8c3ff, #6d8bff)" }}>
                <Bot className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">AI Companion</p>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
                <p className="text-xs text-muted-foreground">Chat anytime — private & warm</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>

      </div>

      {/* Prompt chips */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Start with a feeling
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PROMPTS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => startWith.mutate()}
              disabled={startWith.isPending}
              className={`group flex items-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-br ${p.tone} px-3 py-3 text-left text-sm font-medium text-neutral-900 card-lift animate-slide-in-up stagger-${i + 1}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-brand-accent transition-transform group-hover:animate-tilt-wiggle">
                <p.icon className="h-4 w-4" />
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress and Trend */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Progress and Trend
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-soft card-lift">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Mood Trend</p>
              <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-accent">
                Weekly
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full">
              <defs>
                <linearGradient id="mood-grad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#ffd28a" />
                  <stop offset="100%" stopColor="#e85d3a" />
                </linearGradient>
              </defs>
              <path d={path} fill="none" stroke="url(#mood-grad)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3} fill="#e85d3a" />
              ))}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {DAYS.map((d) => (<span key={d}>{d}</span>))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-soft card-lift">
            <p className="text-sm font-semibold">Check-in Streak</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-full text-white shadow-glow"
                style={{ background: "linear-gradient(135deg, #ffb28a, #e85d3a)" }}>
                <div className="text-center leading-none">
                  <div className="text-xl font-bold">{streak}</div>
                  <div className="text-[9px] uppercase tracking-wider">days</div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-500">
                  <Flame className="h-4 w-4" />
                  <span className="text-sm font-semibold text-foreground">Keep it warm</span>
                </div>
                <p className="text-xs text-muted-foreground">A little every day adds up.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-soft card-lift">
            <p className="text-sm font-semibold">Check-in Score</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-full text-amber-500"
                style={{ background: "conic-gradient(#ffb28a 0 60%, #ffe6d1 60% 100%)" }}>
                <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Bright & steady</p>
                <p className="text-xs text-muted-foreground">You're building a gentle habit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Not therapy or an emergency service. In a crisis, call 988 (US) or your local helpline.
      </p>
    </div>
  );
}
