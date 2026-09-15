import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createMoodCheckIn, listMoodCheckIns } from "@/lib/mood.functions";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Sparkles, TrendingUp, Flame, NotebookPen, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Mood Insights | SomeoneNear" },
      { name: "description", content: "See your mood trend, streak, and patterns over time." },
    ],
  }),
  component: InsightsPage,
});

const MOOD_LABEL: Record<number, { label: string; emoji: string }> = {
  1: { label: "Rough", emoji: "😔" },
  2: { label: "Low", emoji: "😕" },
  3: { label: "Okay", emoji: "😌" },
  4: { label: "Good", emoji: "🙂" },
  5: { label: "Bright", emoji: "😊" },
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const RANGE_OPTIONS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: 0 },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

function InsightsPage() {
  const listFn = useServerFn(listMoodCheckIns);
  const createFn = useServerFn(createMoodCheckIn);
  const qc = useQueryClient();
  const [pendingMood, setPendingMood] = useState<number | null>(null);
  const [range, setRange] = useState<RangeKey>("30");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["mood-checkins"],
    queryFn: () => listFn(),
  });

  const todayKey = dayKey(new Date());
  const todayEntry = entries.find(
    (e) => dayKey(new Date(e.created_at)) === todayKey && e.mood != null,
  );

  const checkInMut = useMutation({
    mutationFn: (mood: number) => createFn({ data: { mood } }),
    onMutate: (mood) => setPendingMood(mood),
    onSuccess: (_, mood) => {
      toast.success(`Checked in as ${MOOD_LABEL[mood].label} ${MOOD_LABEL[mood].emoji}`);
      qc.invalidateQueries({ queryKey: ["mood-checkins"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't save your check-in"),
    onSettled: () => setPendingMood(null),
  });

  const rangeMeta = RANGE_OPTIONS.find((r) => r.key === range)!;

  const stats = useMemo(() => {
    const now = new Date();
    const isAllTime = rangeMeta.days === 0;

    // Determine start date for the window
    let startDate: Date;
    if (isAllTime) {
      const earliest = entries.reduce<number | null>((min, e) => {
        const t = new Date(e.created_at).getTime();
        return min == null || t < min ? t : min;
      }, null);
      startDate = new Date(earliest ?? now.getTime());
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - (rangeMeta.days - 1));
    }

    const totalDays = Math.max(
      1,
      Math.round((new Date(now).setHours(0, 0, 0, 0) - startDate.getTime()) / 86400_000) + 1,
    );

    // For very long ranges, don't render a tick per day
    const useMonthLabel = totalDays > 120;

    const days: { key: string; date: Date; label: string }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        key: dayKey(d),
        date: d,
        label: useMonthLabel
          ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }

    const byDay = new Map<string, { moods: number[]; count: number }>();
    for (const e of entries) {
      const k = dayKey(new Date(e.created_at));
      const cur = byDay.get(k) ?? { moods: [], count: 0 };
      cur.count += 1;
      if (e.mood != null) cur.moods.push(e.mood);
      byDay.set(k, cur);
    }

    const trend = days.map((d) => {
      const b = byDay.get(d.key);
      const avg = b && b.moods.length ? b.moods.reduce((a, m) => a + m, 0) / b.moods.length : null;
      return { label: d.label, mood: avg, entries: b?.count ?? 0 };
    });

    // Streak: always from today, independent of range
    let streak = 0;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const k = dayKey(cursor);
      if ((byDay.get(k)?.count ?? 0) > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    // Entries within selected window
    const windowEntries = entries.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= startDate.getTime();
    });

    const moodEntries = windowEntries.filter((e) => e.mood != null);
    const avgMood = moodEntries.length
      ? moodEntries.reduce((a, e) => a + (e.mood ?? 0), 0) / moodEntries.length
      : null;

    const dist = [1, 2, 3, 4, 5].map((v) => ({
      label: `${MOOD_LABEL[v].emoji} ${MOOD_LABEL[v].label}`,
      count: moodEntries.filter((e) => e.mood === v).length,
    }));

    return {
      trend,
      streak,
      avgMood,
      totalEntries: entries.length,
      windowCount: windowEntries.length,
      dist,
    };
  }, [entries, rangeMeta]);


  return (
    <AppShell>
      <PageHeader
        eyebrow="Patterns you can trust"
        slogan="Small patterns, big kindness."
        title="Mood insights"
        description="A gentle look at how you've been. Only visible to you."
      />

      <section className="rounded-brand border border-border bg-surface p-4 sm:p-5 mb-6 animate-fade-up card-lift">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-foreground">Today's check-in</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todayEntry
                ? `You checked in as ${MOOD_LABEL[todayEntry.mood!].label} today. Tap again to add another.`
                : "One tap saves your mood, no writing needed."}
            </p>
          </div>
          {todayEntry && (
            <span className="inline-flex items-center gap-1 rounded-brand bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary">
              <Check className="h-3.5 w-3.5" /> Done today
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((v) => {
            const m = MOOD_LABEL[v];
            const isPending = pendingMood === v && checkInMut.isPending;
            const isTodayMood = todayEntry?.mood === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => checkInMut.mutate(v)}
                disabled={checkInMut.isPending}
                aria-label={`Check in as ${m.label}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-brand border px-2 py-3 transition active:scale-[0.97] disabled:opacity-60",
                  isTodayMood
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-border bg-background hover:border-brand-primary/50 hover:bg-brand-primary/5",
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : m.emoji}
                </span>
                <span className="text-[11px] font-medium text-foreground">{m.label}</span>
              </button>
            );
          })}
        </div>
      </section>


      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-72 sm:col-span-3" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-5 w-5" />}
          title="No check-ins yet"
          description="Tap a mood above to start seeing your patterns here."
        />


      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">Time range:</span>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={cn(
                  "rounded-brand border px-3 py-1.5 text-xs font-medium transition",
                  range === opt.key
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-border bg-background text-foreground hover:border-brand-primary/50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            {[
              {
                icon: Sparkles,
                label: `Average mood (${rangeMeta.label.toLowerCase()})`,
                value: stats.avgMood
                  ? `${MOOD_LABEL[Math.round(stats.avgMood)].emoji} ${stats.avgMood.toFixed(1)} / 5`
                  : ", ",
                hint: stats.avgMood ? MOOD_LABEL[Math.round(stats.avgMood)].label : "No moods logged",
              },
              {
                icon: Flame,
                label: "Current streak",
                value: `${stats.streak} day${stats.streak === 1 ? "" : "s"}`,
                hint: stats.streak >= 3 ? "You're showing up for yourself." : "One entry today keeps it going.",
              },
              {
                icon: TrendingUp,
                label: `Entries (${rangeMeta.label.toLowerCase()})`,
                value: String(stats.windowCount),
                hint: `${stats.totalEntries} total`,
              },
            ].map((s, i) => (
              <div key={s.label} style={{ animationDelay: `${i * 80}ms` }} className="animate-pop-in">
                <StatCard icon={s.icon} label={s.label} value={s.value} hint={s.hint} />
              </div>
            ))}
          </div>

          <section className="rounded-brand border border-border bg-surface p-4 sm:p-5 mb-6 animate-fade-up card-lift" style={{ animationDelay: "240ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Mood over the {rangeMeta.label.toLowerCase()}</h2>
              <span className="text-xs text-muted-foreground">Daily average</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="var(--muted-foreground)" />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => {
                      const n = typeof v === "number" ? v : v == null ? null : Number(v);
                      return n == null || Number.isNaN(n)
                        ? ["No entry", "Mood"]
                        : [`${MOOD_LABEL[Math.round(n)].emoji} ${n.toFixed(1)}`, "Mood"];
                    }}

                  />
                  <Area
                    type="monotone"
                    dataKey="mood"
                    stroke="var(--brand-primary)"
                    strokeWidth={2}
                    fill="url(#moodFill)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-brand border border-border bg-surface p-4 sm:p-5 animate-fade-up card-lift" style={{ animationDelay: "320ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Mood distribution</h2>
              <span className="text-xs text-muted-foreground">{rangeMeta.label}</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dist} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--brand-accent)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-brand border border-border bg-surface p-4 card-lift h-full">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-accent font-medium">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
