import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  HeartHandshake,
  MessageCircleHeart,
  Ear,
  ArrowUpRight,
  Flame,
  Trophy,
  Star,
  Sun,
  Moon,
  Cloud,
  LineChart,
  LifeBuoy,
  Users,
  PhoneCall,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAiQuota } from "@/lib/quota.functions";
import { isCurrentUserAdmin } from "@/lib/feedback-admin.functions";
import heroMug from "@/assets/checkin-hero.png";
import bloomOrb from "@/assets/bloom-orb.png";
import avatarGrandma from "@/assets/avatar-grandma.png";
import avatarDad from "@/assets/avatar-dad.png";
import avatarMom from "@/assets/avatar-mom.png";
import avatarTeen from "@/assets/avatar-teen.png";
import avatarKid from "@/assets/avatar-kid.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | SomeoneNear" },
      { name: "description", content: "Your calm daily check-in and Care Membership overview." },
    ],
  }),
  component: Dashboard,
});

type ProfileSummary = {
  display_name: string | null;
  care_tier: string;
  care_status: string;
  care_since: string;
};

const TIER_LABEL: Record<string, string> = {
  free: "No active plan",
  together: "Together",
  family: "Family",
  care: "Care",
};

const QUOTES = [
  "You showed up today, that already matters.",
  "Small breaths, small steps. Both count.",
  "Being gentle with yourself is brave.",
  "Feelings pass through, you don't have to hold them all.",
  "Your presence is enough for today.",
  "One kind thought at a time.",
];

function greeting(): { text: string; icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", icon: Sun };
  if (h < 18) return { text: "Good afternoon", icon: Cloud };
  return { text: "Good evening", icon: Moon };
}

function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  sub: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd28a" />
            <stop offset="60%" stopColor="#ff8f6b" />
            <stop offset="100%" stopColor="#e85d3a" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-white/60" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="fill-none transition-all duration-700"
          stroke="url(#ring-grad)"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-bold leading-none text-foreground">{label}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-foreground/60">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const adminFn = useServerFn(isCurrentUserAdmin);
  const adminQ = useQuery({
    queryKey: ["admin", "role-check"],
    queryFn: () => adminFn({}),
    staleTime: 5 * 60 * 1000,
  });

  if (adminQ.isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-40 w-full rounded-brand" />
      </AppShell>
    );
  }

  if (adminQ.data?.isAdmin) return <AdminDashboard />;

  return <MemberDashboard />;
}

function AdminDashboard() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Operations dashboard"
        description="Manage listener calls and your call team from one focused workspace."
      />
      <section className="max-w-2xl rounded-brand border border-border bg-surface p-6 shadow-gentle sm:p-8">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-brand bg-primary/10 text-primary">
            <PhoneCall className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Call CRM</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Review the call queue, assign agents, monitor service levels, and resolve call flags.
            </p>
            <Button asChild className="mt-5">
              <Link to="/admin/calls">Open Call CRM <ArrowUpRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function MemberDashboard() {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [checkInCount, setCheckInCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const quotaFn = useServerFn(getMyAiQuota);
  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ["ai-quota"],
    queryFn: () => quotaFn(),
  });

  const quote = useMemo(() => {
    const idx = new Date().getDate() % QUOTES.length;
    return QUOTES[idx];
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setLoading(false);
          return;
        }
        const [{ data: prof }, { data: entries }] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, care_tier, care_status, care_since")
            .eq("id", userData.user.id)
            .maybeSingle(),
          supabase
            .from("journal_entries")
            .select("created_at")
            .eq("user_id", userData.user.id)
            .order("created_at", { ascending: false })
            .limit(60),
        ]);
        setProfile(prof);
        if (entries?.length) {
          const days = new Set(
            entries.map((e) => new Date(e.created_at as string).toDateString()),
          );
          let s = 0;
          const cur = new Date();
          while (days.has(cur.toDateString())) {
            s += 1;
            cur.setDate(cur.getDate() - 1);
          }
          setStreak(s);
          setCheckInCount(entries.length);
        }
      } catch (e) {
        console.error("dashboard load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="h-56 w-full rounded-3xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  const firstName = profile?.display_name?.split(" ")[0] ?? "friend";
  const tier = profile?.care_tier ?? "free";
  const tierLabel = TIER_LABEL[tier] ?? "No active plan";
  const { text: greetText, icon: GreetIcon } = greeting();

  const quotaUnlimited = !!quota && quota.unlimited;
  const quotaPct = quota
    ? quotaUnlimited
      ? 100
      : Math.min(100, Math.round(((quota.remaining ?? 0) / Math.max(1, quota.limit ?? 1)) * 100))
    : 0;
  const resetsAt = quota
    ? new Date(quota.resets_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  const badges = [
    { label: "First check-in", earned: checkInCount >= 1, tone: "gradient-peach" },
    { label: "3-day streak", earned: streak >= 3, tone: "gradient-sage" },
    { label: "Reflective 10", earned: checkInCount >= 10, tone: "gradient-blush" },
    { label: "Guardian", earned: streak >= 7, tone: "gradient-lilac" },
  ];

  return (
    <AppShell>
      {/* HERO CHECK-IN */}
      <section className="relative overflow-hidden rounded-3xl gradient-sunrise p-5 shadow-glow sm:p-8 md:p-10">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/25 blur-3xl sm:h-72 sm:w-72"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-coral/30 blur-3xl sm:h-72 sm:w-72"
        />

        <div className="relative grid gap-5 md:grid-cols-[1.5fr_1fr] md:items-center md:gap-6">
          <div className="min-w-0 text-neutral-900">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-[11px] font-medium backdrop-blur sm:text-xs">
              <GreetIcon className="h-3.5 w-3.5" />
              {greetText}
            </div>
            <h1 className="mt-3 text-[1.6rem] font-bold leading-tight tracking-tight sm:mt-4 sm:text-4xl md:text-5xl">
              {greetText}, {firstName}{" "}
              <span className="inline-block animate-float">☀️</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-neutral-800/85 sm:mt-3 sm:text-base">
              A few minutes for you can make a big difference. Ready for today's check-in?
            </p>
            <blockquote className="mt-3 hidden max-w-md border-l-2 border-white/70 pl-3 text-sm italic text-neutral-800/90 sm:block">
              "{quote}"
            </blockquote>

            <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button
                asChild
                size="lg"
                className="w-full rounded-2xl bg-neutral-900 px-6 text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:bg-neutral-800 sm:w-auto"
              >
                <Link to="/companion">
                  <Sparkles className="mr-2 h-4 w-4" /> Start today's check-in
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="w-full rounded-2xl bg-white/70 text-neutral-900 backdrop-blur hover:bg-white sm:w-auto"
              >
                <Link to="/insights">
                  <LineChart className="mr-2 h-4 w-4" /> Quick mood check-in
                </Link>
              </Button>
            </div>
          </div>

          <div className="orbit-stage relative order-first mx-auto flex aspect-square w-full max-w-80 items-center justify-center overflow-hidden md:order-last">
            {/* pulsing halo behind hero */}
            <span
              aria-hidden
              className="pointer-events-none absolute h-40 w-40 rounded-full bg-white/40 sm:h-56 sm:w-56 md:h-64 md:w-64"
              style={{ animation: "avatar-glow 4s ease-in-out infinite" }}
            />
            <img
              src={heroMug}
              alt=""
              width={280}
              height={280}
              className="relative z-10 h-32 w-32 shrink-0 animate-float object-contain drop-shadow-xl sm:h-52 sm:w-52 md:h-64 md:w-64"
            />
            <img
              src={bloomOrb}
              alt=""
              width={140}
              height={140}
              className="absolute left-2 top-1 h-16 w-16 animate-bloom opacity-90 sm:-left-2 sm:top-4 sm:h-24 sm:w-24"
            />

            {/* orbit ring, family avatars circling the hero */}
            <div
              aria-hidden
              className="hero-orbit-ring orbit-ring pointer-events-none absolute inset-0 [--orbit-r:5.5rem] sm:[--orbit-r:7.5rem] md:[--orbit-r:8.5rem]"
            >
              {[avatarGrandma, avatarDad, avatarMom, avatarTeen, avatarKid].map((src, i) => {
                const angle = (360 / 5) * i;
                const delay = `${i * 0.35}s`;
                return (
                  <div
                    key={i}
                    className="orbit-slot absolute left-1/2 top-1/2 h-9 w-9 sm:h-10 sm:w-10 -ml-[18px] -mt-[18px] sm:-ml-5 sm:-mt-5"
                    style={{
                      transform: `rotate(${angle}deg) translateX(var(--orbit-r)) rotate(-${angle}deg) translateZ(0)`,
                    }}
                  >
                    <div className="hero-orbit-counter orbit-counter h-full w-full">
                      <div
                        className="hero-avatar-bob orbit-avatar relative h-full w-full"
                        style={{ animationDelay: delay }}
                      >
                        <span
                          className="hero-avatar-glow orbit-halo pointer-events-none absolute -inset-1 rounded-full"
                          style={{
                            background:
                              "radial-gradient(closest-side, hsl(var(--primary) / 0.55), hsl(var(--coral) / 0.35) 60%, transparent 75%)",
                            animationDelay: delay,
                          }}
                        />
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={40}
                          height={40}
                          className="orbit-img relative h-full w-full rounded-full border-[3px] border-white object-cover shadow-soft bg-white"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>


      {/* STATS ROW */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 [&>*]:animate-pop-in [&>*:nth-child(1)]:[animation-delay:60ms] [&>*:nth-child(2)]:[animation-delay:140ms] [&>*:nth-child(3)]:[animation-delay:220ms] [&>*:nth-child(4)]:[animation-delay:300ms]">
        <StatTile
          gradient="gradient-blush"
          icon={<Flame className="h-5 w-5 text-coral" />}
          label="Current streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          hint={streak > 0 ? "Keep it going!" : "Start today"}
        />
        <StatTile
          gradient="gradient-mint"
          icon={<LineChart className="h-5 w-5 text-sage" />}
          label="Mood check-ins"
          value={`${checkInCount}`}
          hint="private & yours"
        />
        <StatTile
          gradient="gradient-sky"
          icon={<HeartHandshake className="h-5 w-5 text-neutral-700" />}
          label="Membership"
          value={tierLabel}
          hint={profile?.care_status ?? "active"}
        />
        <div className="col-span-2 rounded-3xl gradient-lilac p-4 shadow-soft card-hover sm:p-5 lg:col-span-1">
          <div className="flex items-center justify-between gap-3 text-neutral-800">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wider opacity-70 sm:text-xs">
                Companion quota
              </div>
              <div className="mt-1 text-xl font-bold sm:text-2xl">
                {quotaLoading || !quota ? "…" : quota.remaining}
                <span className="ml-1 text-sm font-normal opacity-70">
                  / {quota?.limit ?? 0}
                </span>
              </div>
              <div className="mt-1 text-[11px] opacity-70">Resets {resetsAt ?? ", "}</div>
            </div>
            <div className="shrink-0">
              <ProgressRing
                value={quotaPct}
                size={74}
                stroke={8}
                label={`${quotaPct}%`}
                sub="left"
              />
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS TILES */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Quick access</h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Everything a tap away
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 [&>*]:animate-fade-up [&>*:nth-child(1)]:[animation-delay:80ms] [&>*:nth-child(2)]:[animation-delay:160ms] [&>*:nth-child(3)]:[animation-delay:240ms] [&>*:nth-child(4)]:[animation-delay:320ms]">

          <QuickTile
            to="/companion"
            gradient="gradient-peach"
            icon={<MessageCircleHeart className="h-6 w-6" />}
            title="AI Companion"
            desc="Talk it through, gently."
          />
          <QuickTile
            to="/listeners"
            gradient="gradient-blush"
            icon={<Ear className="h-6 w-6" />}
            title="Human Listener"
            desc="A real person, on your schedule."
          />
          <QuickTile
            to="/insights"
            gradient="gradient-mint"
            icon={<LineChart className="h-6 w-6" />}
            title="Mood Insights"
            desc="See your patterns over time."
          />
          <QuickTile
            to="/family"
            gradient="gradient-sky"
            icon={<Users className="h-6 w-6" />}
            title="Family Circle"
            desc="Share only what you choose."
          />
        </div>
      </section>

      {/* ACHIEVEMENTS + SIDE */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Trophy className="h-4 w-4 text-coral" /> Achievements
            </h3>
            <Link
              to="/insights"
              className="inline-flex items-center gap-1 text-xs font-medium text-coral hover:underline"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {badges.map((b, i) => (
              <div
                key={b.label}
                className={`group relative flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center animate-pop-in sm:gap-2 sm:p-4 ${
                  b.earned ? b.tone : "bg-muted/60"
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-full sm:h-12 sm:w-12 ${
                    b.earned ? "bg-white/70 text-coral" : "bg-white/40 text-muted-foreground"
                  }`}
                >
                  <Star className={`h-5 w-5 sm:h-6 sm:w-6 ${b.earned ? "fill-coral" : ""}`} />
                </div>
                <span className="text-[11px] font-medium leading-tight text-neutral-800 sm:text-xs">
                  {b.label}
                </span>
                {b.earned && (
                  <span className="text-[9px] uppercase tracking-wider text-coral sm:text-[10px]">
                    Earned
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">

          <Link
            to="/insights"
            className="group flex items-center justify-between rounded-3xl gradient-sage p-5 shadow-soft card-hover"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-neutral-800/70">
                Insights
              </div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">Your mood trends</div>
              <div className="mt-1 text-xs text-neutral-800/70">
                See patterns over time. Gently.
              </div>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-sage transition-transform group-hover:scale-110">
              <LineChart className="h-5 w-5" />
            </div>
          </Link>

          <Link
            to="/safety"
            className="group flex items-center justify-between rounded-3xl gradient-blush p-5 shadow-soft card-hover"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-neutral-800/70">
                Feeling overwhelmed?
              </div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">Safety toolkit</div>
              <div className="mt-1 text-xs text-neutral-800/70">
                Grounding, hotlines, one-tap help.
              </div>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-coral transition-transform group-hover:scale-110">
              <LifeBuoy className="h-5 w-5" />
            </div>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function StatTile({
  gradient,
  icon,
  label,
  value,
  hint,
}: {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div data-tilt="5" className={`card-tilt rounded-3xl p-4 shadow-soft card-hover sm:p-5 ${gradient}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/70 sm:h-10 sm:w-10">
          {icon}
        </div>
        <span className="min-w-0 truncate text-right text-[10px] font-medium uppercase tracking-wider text-neutral-800/60">
          {hint}
        </span>
      </div>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-neutral-800/70 sm:mt-4 sm:text-xs">
        {label}
      </div>
      <div className="mt-0.5 truncate text-xl font-bold text-neutral-900 sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

function QuickTile({
  to,
  gradient,
  icon,
  title,
  desc,
}: {
  to: string;
  gradient: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to as "/companion"}
      data-tilt="6"
      className={`card-tilt group relative overflow-hidden rounded-3xl p-5 shadow-soft card-hover ${gradient}`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/75 text-neutral-800 transition-transform group-hover:-rotate-6 group-hover:scale-110">
        {icon}
      </div>
      <div className="mt-4 text-base font-semibold text-neutral-900">{title}</div>
      <div className="mt-1 text-xs text-neutral-800/70">{desc}</div>
      <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-neutral-800/50 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
    </Link>
  );
}
