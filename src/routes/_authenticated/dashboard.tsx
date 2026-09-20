import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SparkleIcon,
  HandHeartIcon,
  ChatCircleIcon,
  EarIcon,
  ArrowUpRightIcon,
  FireIcon,
  TrophyIcon,
  StarIcon,
  SunIcon,
  MoonIcon,
  CloudIcon,
  ChartLineIcon,
  LifebuoyIcon,
  UsersIcon,
  PhoneCallIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAiQuota } from "@/lib/quota.functions";
import { isCurrentUserAdmin } from "@/lib/feedback-admin.functions";
import { PLAN_DISPLAY } from "@/lib/currency";
import { Orb, OrbSparkle, type OrbTone } from "@/components/landing/playroom-orb";
import { useDashboardMotion } from "@/hooks/use-dashboard-motion";

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

// Names come from the plan catalogue so they can't drift from billing.
const TIER_LABEL: Record<string, string> = {
  free: "No active plan",
  care: PLAN_DISPLAY.care.name,
  care_plus: PLAN_DISPLAY.care_plus.name,
};

const QUOTES = [
  "You showed up today, that already matters.",
  "Small breaths, small steps. Both count.",
  "Being gentle with yourself is brave.",
  "Feelings pass through, you don't have to hold them all.",
  "Your presence is enough for today.",
  "One kind thought at a time.",
];

function greeting(): { text: string; icon: typeof SunIcon } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", icon: SunIcon };
  if (h < 18) return { text: "Good afternoon", icon: CloudIcon };
  return { text: "Good evening", icon: MoonIcon };
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
            <PhoneCallIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Call CRM</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Review the call queue, assign agents, monitor service levels, and resolve call flags.
            </p>
            <Button asChild className="mt-5">
              <Link to="/admin/calls">Open Call CRM <ArrowUpRightIcon className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

/** Earned badges cycle through the orb family rather than all being identical. */
const BADGE_TONES: OrbTone[] = ["saffron", "terracotta", "periwinkle", "grass"];

function MemberDashboard() {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [checkInCount, setCheckInCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const quotaFn = useServerFn(getMyAiQuota);
  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ["ai-quota"],
    queryFn: () => quotaFn(),
  });

  const quote = useMemo(() => {
    const idx = new Date().getDate() % QUOTES.length;
    return QUOTES[idx];
  }, []);

  // Runs once `loading` flips, so the counters animate toward real values
  // rather than counting to zero and then snapping.
  useDashboardMotion(rootRef, !loading);

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
  const resetsAt = quota
    ? new Date(quota.resets_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  const badges = [
    { label: "First check-in", earned: checkInCount >= 1 },
    { label: "3-day streak", earned: streak >= 3 },
    { label: "Reflective 10", earned: checkInCount >= 10 },
    { label: "Guardian", earned: streak >= 7 },
  ];

  return (
    <AppShell>
      <div ref={rootRef}>
      {/* HERO CHECK-IN — saffron plate, borrowed from the marketing page so the
          product doesn't change character the moment you sign in. */}
      <section className="relative overflow-hidden rounded-[28px] bg-plate-saffron px-6 py-8 text-ink sm:px-9 sm:py-10">
        {/* Scenery. Faceless on purpose — these are not characters. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div data-dash-orb className="absolute -right-6 -top-6 opacity-90">
            <Orb tone="terracotta" face="smile" className="h-28 w-28" />
          </div>
          <div data-dash-orb className="absolute bottom-4 right-16 hidden sm:block">
            <Orb tone="navy" face="calm" className="h-12 w-12" />
          </div>
          <div data-dash-orb className="absolute right-40 top-8 hidden lg:block">
            <OrbSparkle className="h-5 w-5 text-ink/40" />
          </div>
        </div>

        <div className="relative max-w-xl">
          <div
            data-dash-pill
            className="inline-flex items-center gap-2 rounded-full bg-ink/10 px-3 py-1 text-xs font-bold text-ink"
          >
            <GreetIcon className="h-3.5 w-3.5" />
            {greetText}
          </div>

          <h1
            data-dash-headline
            className="mt-4 text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-[2.6rem]"
          >
            {greetText}, {firstName}
          </h1>

          <div data-dash-sub>
            <p className="mt-2.5 text-[0.95rem] font-medium leading-relaxed text-ink/75">
              A few minutes for you can make a big difference. Ready for today&apos;s
              check-in?
            </p>
            <blockquote className="mt-3 border-l-2 border-ink/25 pl-3 text-sm italic text-ink/70">
              &ldquo;{quote}&rdquo;
            </blockquote>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              asChild
              size="lg"
              data-dash-cta
              className="rounded-full bg-ink px-6 font-bold text-background hover:bg-ink/90"
            >
              <Link to="/companion">
                <SparkleIcon className="mr-2 h-4 w-4" /> Start today&apos;s check-in
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              data-dash-cta
              variant="ghost"
              className="rounded-full font-bold text-ink hover:bg-ink/10"
            >
              <Link to="/insights">
                <ChartLineIcon className="mr-2 h-4 w-4" /> Quick mood check-in
              </Link>
            </Button>
          </div>
        </div>
      </section>


      {/* STATS ROW — separate cards rather than one divided slab, so each can
          carry its own tone and animate in independently. */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          tone="terracotta"
          icon={<FireIcon className="h-4 w-4" />}
          label="Current streak"
          // Numeric stats count up; the unit stays static beside them.
          countTo={streak}
          unit={streak === 1 ? "day" : "days"}
          hint={streak > 0 ? "Keep it going" : "Start today"}
        />
        <StatCard
          tone="periwinkle"
          icon={<ChartLineIcon className="h-4 w-4" />}
          label="Mood check-ins"
          countTo={checkInCount}
          hint="Private and yours"
        />
        <StatCard
          tone="navy"
          icon={<HandHeartIcon className="h-4 w-4" />}
          label="Membership"
          value={tierLabel}
          hint={profile?.care_status ?? "active"}
        />
        <StatCard
          tone="grass"
          icon={<SparkleIcon className="h-4 w-4" />}
          label="Companion quota"
          value={
            quotaLoading || !quota ? "…" : quotaUnlimited ? "Unlimited" : String(quota.remaining)
          }
          hint={quotaUnlimited ? "Chat as much as you need" : `Refills ${resetsAt ?? "daily"}`}
        />
      </section>

      {/* QUICK ACCESS — full-colour plates, so the four destinations are
          distinguishable at a glance rather than four identical grey cards. */}
      <section data-dash-section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight">Quick access</h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Everything a tap away
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <QuickTile
            to="/companion"
            plate="bg-plate-navy"
            ink="text-background"
            orb="saffron"
            icon={<ChatCircleIcon className="h-5 w-5" />}
            title="AI Companion"
            desc="Talk it through, gently."
          />
          <QuickTile
            to="/listeners"
            plate="bg-plate-saffron"
            ink="text-ink"
            orb="terracotta"
            icon={<EarIcon className="h-5 w-5" />}
            title="Human Listener"
            desc="A real person, on your schedule."
          />
          <QuickTile
            to="/insights"
            plate="bg-plate-periwinkle"
            ink="text-ink"
            orb="navy"
            icon={<ChartLineIcon className="h-5 w-5" />}
            title="Mood Insights"
            desc="See your patterns over time."
          />
          <QuickTile
            to="/family"
            plate="bg-plate-pink"
            ink="text-ink"
            orb="grass"
            icon={<UsersIcon className="h-5 w-5" />}
            title="Family Circle"
            desc="Share only what you choose."
          />
        </div>
      </section>

      {/* ACHIEVEMENTS + SIDE */}
      <section data-dash-section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[24px] border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
              <TrophyIcon className="h-4 w-4 text-orb-terracotta" weight="fill" /> Achievements
            </h3>
            <Link
              to="/insights"
              className="inline-flex items-center gap-1 text-xs font-bold text-orb-terracotta hover:underline"
            >
              View all <ArrowUpRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {badges.map((b, i) => (
              <div
                key={b.label}
                data-dash-badge
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center sm:p-4 ${
                  b.earned
                    ? "border-orb-terracotta/35 bg-orb-terracotta/8"
                    : "border-border bg-muted/40"
                }`}
              >
                {/* Earned badges get a real character orb; unearned stay a
                    muted outline, so progress reads instantly. */}
                {b.earned ? (
                  <Orb
                    tone={BADGE_TONES[i % BADGE_TONES.length]}
                    face="smile"
                    className="h-10 w-10 sm:h-11 sm:w-11"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground sm:h-11 sm:w-11">
                    <StarIcon className="h-5 w-5" />
                  </div>
                )}
                <span className="text-xs font-bold leading-tight">{b.label}</span>
                {b.earned && (
                  <span className="text-[11px] font-semibold text-orb-terracotta">
                    Earned
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <SideCard
            to="/insights"
            eyebrow="Insights"
            title="Your mood trends"
            desc="See patterns over time. Gently."
            icon={<ChartLineIcon className="h-5 w-5" />}
            tone="periwinkle"
          />
          <SideCard
            to="/safety"
            eyebrow="Feeling overwhelmed?"
            title="Safety toolkit"
            desc="Grounding, hotlines, one-tap help."
            icon={<LifebuoyIcon className="h-5 w-5" />}
            tone="terracotta"
          />
        </div>
      </section>
      </div>
    </AppShell>
  );
}

/** Maps an orb tone to its icon-chip classes, so tone lives in one place. */
const TONE_CHIP: Record<OrbTone, string> = {
  saffron: "bg-orb-saffron/20 text-ink",
  pink: "bg-orb-pink/25 text-ink",
  aqua: "bg-orb-aqua/20 text-orb-aqua",
  grass: "bg-orb-grass/15 text-orb-grass",
  navy: "bg-orb-navy/12 text-orb-navy",
  periwinkle: "bg-orb-periwinkle/25 text-orb-navy",
  terracotta: "bg-orb-terracotta/15 text-orb-terracotta",
};

function StatCard({
  tone,
  icon,
  label,
  value,
  countTo,
  unit,
  hint,
}: {
  tone: OrbTone;
  icon: React.ReactNode;
  label: string;
  /** Static display value. Ignored when `countTo` is supplied. */
  value?: string;
  /** Numeric value to count up to. */
  countTo?: number;
  unit?: string;
  hint: string;
}) {
  return (
    <div
      data-dash-stat
      className="rounded-[20px] border border-border bg-card p-4 transition-colors hover:border-ink/20"
    >
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}
      >
        {icon}
      </span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1 text-2xl font-extrabold tracking-tight">
        {countTo !== undefined ? (
          <>
            {/* The number itself carries the counter hook; the markup still
                ships the real value so it is correct without JS. */}
            <span data-dash-counter={countTo} className="tabular-nums">
              {countTo.toLocaleString()}
            </span>
            {unit && (
              <span className="text-sm font-bold text-muted-foreground">{unit}</span>
            )}
          </>
        ) : (
          <span className="truncate text-xl">{value}</span>
        )}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function QuickTile({
  to,
  plate,
  ink,
  orb,
  icon,
  title,
  desc,
}: {
  to: string;
  plate: string;
  ink: string;
  orb: OrbTone;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to as "/companion"}
      data-dash-tile
      className={`group relative overflow-hidden rounded-[22px] p-5 transition-transform hover:-translate-y-1 ${plate} ${ink}`}
    >
      {/* Oversized orb bleeding off the corner, echoing the marketing plates */}
      <Orb
        tone={orb}
        face="calm"
        className="pointer-events-none absolute -bottom-6 -right-5 h-20 w-20 opacity-90 transition-transform duration-500 group-hover:scale-110"
      />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-current/15">
        <span className="opacity-90">{icon}</span>
      </span>
      <div className="relative mt-4 text-[0.95rem] font-extrabold leading-tight">
        {title}
      </div>
      <div className="relative mt-1 max-w-[85%] text-xs leading-snug opacity-75">
        {desc}
      </div>
      <ArrowUpRightIcon className="absolute right-4 top-4 h-4 w-4 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

function SideCard({
  to,
  eyebrow,
  title,
  desc,
  icon,
  tone,
}: {
  to: string;
  eyebrow: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  tone: OrbTone;
}) {
  return (
    <Link
      to={to as "/insights"}
      className="group flex items-center justify-between gap-3 rounded-[20px] border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-ink/20"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </div>
        <div className="mt-1 text-base font-extrabold tracking-tight">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
      </div>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${TONE_CHIP[tone]}`}
      >
        {icon}
      </span>
    </Link>
  );
}
