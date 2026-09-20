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
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAiQuota } from "@/lib/quota.functions";
import { isCurrentUserAdmin } from "@/lib/feedback-admin.functions";
import { PLAN_DISPLAY } from "@/lib/currency";

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
      {/* HERO CHECK-IN */}
      <section className="rounded-xl border border-border bg-primary/8 p-6 sm:p-8 md:p-10">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-brand border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GreetIcon className="h-3.5 w-3.5" />
            {greetText}
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            {greetText}, {firstName}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            A few minutes for you can make a big difference. Ready for today's check-in?
          </p>
          <blockquote className="mt-3 border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground">
            "{quote}"
          </blockquote>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link to="/companion">
                <SparkleIcon className="mr-2 h-4 w-4" /> Start today's check-in
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/insights">
                <ChartLineIcon className="mr-2 h-4 w-4" /> Quick mood check-in
              </Link>
            </Button>
          </div>
        </div>
      </section>


      {/* STATS ROW */}
      <section className="mt-6 divide-y divide-border rounded-xl border border-border bg-card sm:grid sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        <StatRow
          icon={<FireIcon className="h-5 w-5 text-primary" />}
          label="Current streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          hint={streak > 0 ? "Keep it going" : "Start today"}
        />
        <StatRow
          icon={<ChartLineIcon className="h-5 w-5 text-primary" />}
          label="Mood check-ins"
          value={`${checkInCount}`}
          hint="Private and yours"
        />
        <StatRow
          icon={<HandHeartIcon className="h-5 w-5 text-primary" />}
          label="Membership"
          value={tierLabel}
          hint={profile?.care_status ?? "active"}
        />
        <StatRow
          icon={<SparkleIcon className="h-5 w-5 text-primary" />}
          label="Companion quota"
          value={
            quotaLoading || !quota ? "…" : quotaUnlimited ? "Unlimited" : String(quota.remaining)
          }
          hint={quotaUnlimited ? "Chat as much as you need" : `Refills ${resetsAt ?? "daily"}`}
        />
      </section>

      {/* QUICK ACCESS TILES */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Quick access</h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Everything a tap away
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <QuickTile
            to="/companion"
            icon={<ChatCircleIcon className="h-6 w-6" />}
            title="AI Companion"
            desc="Talk it through, gently."
          />
          <QuickTile
            to="/listeners"
            icon={<EarIcon className="h-6 w-6" />}
            title="Human Listener"
            desc="A real person, on your schedule."
          />
          <QuickTile
            to="/insights"
            icon={<ChartLineIcon className="h-6 w-6" />}
            title="Mood Insights"
            desc="See your patterns over time."
          />
          <QuickTile
            to="/family"
            icon={<UsersIcon className="h-6 w-6" />}
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
              <TrophyIcon className="h-4 w-4 text-coral" /> Achievements
            </h3>
            <Link
              to="/insights"
              className="inline-flex items-center gap-1 text-xs font-medium text-coral hover:underline"
            >
              View all <ArrowUpRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {badges.map((b) => (
              <div
                key={b.label}
                className={`flex flex-col items-center gap-1.5 rounded-brand border p-3 text-center sm:gap-2 sm:p-4 ${
                  b.earned ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12 ${
                    b.earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <StarIcon className="h-5 w-5 sm:h-6 sm:w-6" weight={b.earned ? "fill" : "regular"} />
                </div>
                <span className="text-xs font-medium leading-tight text-foreground">
                  {b.label}
                </span>
                {b.earned && (
                  <span className="text-[11px] text-primary">Earned</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">

          <Link
            to="/insights"
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="text-xs font-medium text-muted-foreground">Insights</div>
              <div className="mt-1 text-base font-medium text-foreground">Your mood trends</div>
              <div className="mt-1 text-xs text-muted-foreground">
                See patterns over time. Gently.
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-primary/10 text-primary">
              <ChartLineIcon className="h-5 w-5" />
            </div>
          </Link>

          <Link
            to="/safety"
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="text-xs font-medium text-muted-foreground">Feeling overwhelmed?</div>
              <div className="mt-1 text-base font-medium text-foreground">Safety toolkit</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Grounding, hotlines, one-tap help.
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-primary/10 text-primary">
              <LifebuoyIcon className="h-5 w-5" />
            </div>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function StatRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 sm:flex-col sm:items-start sm:gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-brand bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-xl font-semibold text-foreground">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function QuickTile({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to as "/companion"}
      className="group relative rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-brand bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="mt-4 text-base font-medium text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      <ArrowUpRightIcon className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}
