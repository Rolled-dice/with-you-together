import { useTimeZone } from "@/lib/frontend/use-time-zone";
import { localInput } from "@/lib/frontend/time";
import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { JournalSection } from "@/components/insights/journal-section";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createMoodCheckIn, listMoodCheckIns, listJournalEntries } from "@/lib/mood.functions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  SparkleIcon,
  TrendUpIcon,
  FireIcon,
  NotebookIcon,
  CheckIcon,
  SpinnerGapIcon,
  CalendarDotsIcon,
  DownloadSimpleIcon,
  HeartIcon,
  SmileyIcon,
  CopyIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

const MOOD_LABEL: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: "Rough", emoji: "😔", color: "#64748b" },
  2: { label: "Low", emoji: "😕", color: "#38bdf8" },
  3: { label: "Okay", emoji: "😌", color: "#2dd4bf" },
  4: { label: "Good", emoji: "🙂", color: "#fbbf24" },
  5: { label: "Bright", emoji: "😊", color: "#f97316" },
};

const RANGE_OPTIONS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: 0 },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

function InsightsPage() {
  const zone = useTimeZone();
  const dayKey = useCallback(
    (d: Date) => localInput(d, zone.data || "UTC").slice(0, 10),
    [zone.data],
  );
  const listFn = useServerFn(listMoodCheckIns);
  const listJournalFn = useServerFn(listJournalEntries);
  const createFn = useServerFn(createMoodCheckIn);
  const qc = useQueryClient();

  const [pendingMood, setPendingMood] = useState<number | null>(null);
  const [range, setRange] = useState<RangeKey>("30");
  const [mounted, setMounted] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: entries = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["mood-checkins"],
    queryFn: () => listFn(),
  });

  const { data: journalEntries = [] } = useQuery({
    queryKey: ["journal-entries-summary"],
    queryFn: () => listJournalFn(),
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
    const now = new Date(`${dayKey(new Date())}T12:00:00Z`);
    const isAllTime = rangeMeta.days === 0;

    // Determine start date for the window
    let startDate: Date;
    if (isAllTime) {
      const earliest = entries.reduce<number | null>((min, e) => {
        const t = new Date(e.created_at).getTime();
        return min == null || t < min ? t : min;
      }, null);
      startDate = new Date(`${dayKey(new Date(earliest ?? Date.now()))}T00:00:00Z`);
      startDate.setUTCHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now);
      startDate.setUTCHours(0, 0, 0, 0);
      startDate.setUTCDate(startDate.getUTCDate() - (rangeMeta.days - 1));
    }

    const totalDays = Math.max(
      1,
      Math.round((new Date(now).setUTCHours(0, 0, 0, 0) - startDate.getTime()) / 86400_000) + 1,
    );

    const useMonthLabel = totalDays > 120;

    const days: { key: string; date: Date; label: string }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        date: d,
        label: useMonthLabel
          ? d.toLocaleDateString("en", { timeZone: "UTC", month: "short", year: "2-digit" })
          : d.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" }),
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

    // Forgiving, accurate streak logic
    const todayStr = dayKey(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = dayKey(yesterdayDate);

    const checkedInToday = (byDay.get(todayStr)?.count ?? 0) > 0;
    const checkedInYesterday = (byDay.get(yesterdayStr)?.count ?? 0) > 0;

    let streak = 0;
    if (checkedInToday) {
      const cursor = new Date(now);
      cursor.setUTCHours(0, 0, 0, 0);
      while (true) {
        const k = cursor.toISOString().slice(0, 10);
        if ((byDay.get(k)?.count ?? 0) > 0) {
          streak++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else break;
      }
    } else if (checkedInYesterday) {
      const cursor = new Date(now);
      cursor.setUTCHours(0, 0, 0, 0);
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      while (true) {
        const k = cursor.toISOString().slice(0, 10);
        if ((byDay.get(k)?.count ?? 0) > 0) {
          streak++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else break;
      }
    }

    // Window entries
    const windowEntries = entries.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return dayKey(new Date(t)) >= startDate.toISOString().slice(0, 10);
    });

    const moodEntries = windowEntries.filter((e) => e.mood != null);
    const avgMood = moodEntries.length
      ? moodEntries.reduce((a, e) => a + (e.mood ?? 0), 0) / moodEntries.length
      : null;

    const dist = [1, 2, 3, 4, 5].map((v) => {
      const count = moodEntries.filter((e) => e.mood === v).length;
      const pct = moodEntries.length > 0 ? Math.round((count / moodEntries.length) * 100) : 0;
      return {
        label: `${MOOD_LABEL[v].emoji} ${MOOD_LABEL[v].label}`,
        count,
        pct,
      };
    });

    // Dominant mood
    let dominantMood: number | null = null;
    let maxCount = 0;
    for (let v = 1; v <= 5; v++) {
      const c = moodEntries.filter((e) => e.mood === v).length;
      if (c > maxCount) {
        maxCount = c;
        dominantMood = v;
      }
    }

    // Monthly calendar matrix
    const currDate = new Date();
    const currYear = currDate.getFullYear();
    const currMonth = currDate.getMonth();
    const daysInCurrMonth = new Date(currYear, currMonth + 1, 0).getDate();

    const monthDays: { dayNum: number; dateStr: string; mood: number | null }[] = [];
    for (let d = 1; d <= daysInCurrMonth; d++) {
      const monthDayDate = new Date(currYear, currMonth, d);
      const str = dayKey(monthDayDate);
      const b = byDay.get(str);
      const latestMood = b && b.moods.length ? b.moods[b.moods.length - 1] : null;
      monthDays.push({
        dayNum: d,
        dateStr: str,
        mood: latestMood,
      });
    }

    return {
      trend,
      streak,
      checkedInToday,
      checkedInYesterday,
      avgMood,
      totalEntries: entries.length,
      windowCount: windowEntries.length,
      dist,
      dominantMood,
      monthDays,
      currMonthName: currDate.toLocaleDateString("en", { month: "long" }),
    };
  }, [entries, rangeMeta, dayKey]);

  // Generate export text
  const exportSummaryText = useMemo(() => {
    const lines = [
      "=== SomeoneNear Personal Insights Summary ===",
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      `Total Check-ins Logged: ${stats.totalEntries}`,
      `Current Streak: ${stats.streak} day(s)`,
      `Average Mood: ${stats.avgMood ? `${stats.avgMood.toFixed(1)} / 5` : "No data"}`,
      "",
      "--- Mood Distribution ---",
      ...stats.dist.map((d) => `${d.label}: ${d.count} times (${d.pct}%)`),
      "",
      `--- Recent Journal Reflections (${journalEntries.length} total) ---`,
      ...journalEntries.slice(0, 10).map((j, idx) => {
        const moodStr = j.mood ? ` [Mood: ${MOOD_LABEL[j.mood]?.label || j.mood}]` : "";
        const titleStr = j.title ? ` - "${j.title}"` : "";
        return `${idx + 1}. ${new Date(j.created_at).toLocaleDateString()}${titleStr}${moodStr}\n   ${j.body}\n`;
      }),
    ];
    return lines.join("\n");
  }, [stats, journalEntries]);

  const copyExportSummary = () => {
    navigator.clipboard.writeText(exportSummaryText);
    toast.success("Insights summary copied to clipboard!");
  };

  const downloadExportSummary = () => {
    const blob = new Blob([exportSummaryText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `someonenear-insights-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Insights file downloaded!");
  };

  if (zone.isPending) {
    return (
      <AppShell>
        <DataSkeleton />
      </AppShell>
    );
  }

  if (zone.isError || isError) {
    return (
      <AppShell>
        <DataError
          retry={() => {
            void zone.refetch();
            void refetch();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="📈 Mood & Wellness Insights"
        slogan="Small patterns, big kindness."
        title="Mood insights"
        description="A gentle look at how you've been. Only visible to you."
      />

      {/* Top Level Care Metrics */}
      <div className="sn-worker-trust-grid sn-worker-insight-summary">
        <article>
          <span className="sn-worker-status">Emotional warmth</span>
          <h2>{stats.avgMood ? `${stats.avgMood.toFixed(1)} / 5` : "Your first check-in"}</h2>
          <p>
            {stats.avgMood
              ? `Average mood: ${MOOD_LABEL[Math.round(stats.avgMood)]?.label} ${MOOD_LABEL[Math.round(stats.avgMood)]?.emoji}`
              : "Your private mood pattern will appear after you check in."}
          </p>
        </article>

        <article>
          <span className="sn-worker-status">Care consistency</span>
          <h2>{stats.streak}-day check-in streak</h2>
          <p>
            {stats.checkedInToday
              ? "Kept alive today! Wonderful commitment to yourself."
              : stats.checkedInYesterday
                ? `Active from yesterday! Tap a mood below to extend to ${stats.streak + 1} days.`
                : "A little space for yourself, one day at a time."}
          </p>
        </article>

        <article>
          <span className="sn-worker-status">Your reflections</span>
          <h2>{stats.totalEntries} recorded entries</h2>
          <p>Private reflections and notes, completely secure.</p>
        </article>
      </div>

      <div className="space-y-8">
        {/* Today's Mood Check-in Card */}
        <section
          data-page-reveal
          className="rounded-[20px] border border-border bg-card p-5 sm:p-6 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Today's Check-in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {todayEntry
                  ? `You checked in as ${MOOD_LABEL[todayEntry.mood!].label} ${MOOD_LABEL[todayEntry.mood!].emoji} today. Tap anytime to update.`
                  : "How are you feeling right now? Tap one button to log."}
              </p>
            </div>
            {todayEntry && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="h-4 w-4" /> Checked in today
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2 sm:gap-3">
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
                    "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-4 transition active:scale-[0.97] disabled:opacity-60",
                    isTodayMood
                      ? "border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm font-bold ring-2 ring-brand-primary/20"
                      : "border-border bg-background hover:border-brand-primary/50 hover:bg-brand-primary/5 text-foreground",
                  )}
                >
                  <span className="text-3xl" aria-hidden>
                    {isPending ? <SpinnerGapIcon className="h-7 w-7 animate-spin" /> : m.emoji}
                  </span>
                  <span className="text-xs sm:text-sm font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Compassionate Summary Note (if data exists) */}
        {stats.totalEntries > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <HeartIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {stats.avgMood && stats.avgMood >= 3.8
                    ? "Mostly bright and uplifting moments"
                    : stats.avgMood && stats.avgMood >= 2.8
                      ? "Balanced and steady emotional rhythm"
                      : "Tender and gentle days"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.dominantMood
                    ? `Your most frequent mood in this period has been ${MOOD_LABEL[stats.dominantMood].label} ${MOOD_LABEL[stats.dominantMood].emoji}. Remember that all feelings are welcome.`
                    : "Every check-in helps paint a clearer, kinder picture of your wellbeing."}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              className="rounded-full gap-1.5 text-xs font-semibold shrink-0"
            >
              <DownloadSimpleIcon className="h-3.5 w-3.5" />
              Export Summary
            </Button>
          </div>
        )}

        {/* Journal and Reflections Section */}
        <JournalSection
          onEntrySaved={() => {
            qc.invalidateQueries({ queryKey: ["mood-checkins"] });
            qc.invalidateQueries({ queryKey: ["journal-entries-summary"] });
          }}
        />

        {/* Monthly Calendar View */}
        <section
          data-page-reveal
          className="rounded-[20px] border border-border bg-card p-5 sm:p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDotsIcon className="h-5 w-5 text-brand-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {stats.currMonthName} Mood Calendar
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">Every day at a glance</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
              <span key={dayName} className="text-[11px] font-semibold text-muted-foreground py-1">
                {dayName}
              </span>
            ))}

            {/* Empty slots for month start offset */}
            {Array.from({
              length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay(),
            }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10 sm:h-12 rounded-xl bg-muted/20 opacity-30" />
            ))}

            {/* Days of month */}
            {stats.monthDays.map((m) => {
              const isToday = m.dateStr === todayKey;
              return (
                <div
                  key={m.dateStr}
                  title={`${m.dateStr}: ${m.mood ? MOOD_LABEL[m.mood]?.label : "No check-in"}`}
                  className={cn(
                    "flex flex-col items-center justify-between rounded-xl border p-1 sm:p-1.5 h-11 sm:h-13 transition",
                    isToday
                      ? "border-brand-primary bg-brand-primary/10 font-bold"
                      : "border-border/60 bg-background/50 hover:border-brand-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] sm:text-xs",
                      isToday ? "text-brand-primary font-bold" : "text-muted-foreground",
                    )}
                  >
                    {m.dayNum}
                  </span>
                  <span className="text-sm sm:text-base leading-none">
                    {m.mood ? (
                      MOOD_LABEL[m.mood]?.emoji
                    ) : (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-border" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Charts & Analytics */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-72 sm:col-span-3" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<NotebookIcon className="h-5 w-5" />}
            title="No check-ins yet"
            description="Tap a mood above to start seeing your patterns here."
          />
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-medium text-muted-foreground">Time range:</span>
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRange(opt.key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-medium transition",
                      range === opt.key
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary font-bold shadow-sm"
                        : "border-border bg-background text-foreground hover:border-brand-primary/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: SparkleIcon,
                  label: `Average mood (${rangeMeta.label.toLowerCase()})`,
                  value: stats.avgMood
                    ? `${MOOD_LABEL[Math.round(stats.avgMood)].emoji} ${stats.avgMood.toFixed(1)} / 5`
                    : "—",
                  hint: stats.avgMood
                    ? MOOD_LABEL[Math.round(stats.avgMood)].label
                    : "No moods logged",
                },
                {
                  icon: FireIcon,
                  label: "Current streak",
                  value: `${stats.streak} day${stats.streak === 1 ? "" : "s"}`,
                  hint: stats.checkedInToday
                    ? "Checked in today!"
                    : stats.checkedInYesterday
                      ? "Active from yesterday"
                      : "Start fresh today",
                },
                {
                  icon: TrendUpIcon,
                  label: `Entries (${rangeMeta.label.toLowerCase()})`,
                  value: String(stats.windowCount),
                  hint: `${stats.totalEntries} total reflections logged`,
                },
              ].map((s) => (
                <StatCard
                  key={s.label}
                  icon={s.icon}
                  label={s.label}
                  value={s.value}
                  hint={s.hint}
                />
              ))}
            </div>

            {/* Trend Area Chart */}
            <section
              data-page-reveal
              className="rounded-[20px] border border-border bg-card p-5 sm:p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Mood Trend ({rangeMeta.label})</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Daily average recorded feelings
                  </p>
                </div>
                <span className="text-xs font-medium rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  Monitored over time
                </span>
              </div>

              <div className="h-64 w-full">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.trend}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(150, 150, 150, 0.2)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                        stroke="currentColor"
                        opacity={0.6}
                      />
                      <YAxis
                        domain={[1, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{ fontSize: 11 }}
                        stroke="currentColor"
                        opacity={0.6}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card, #fff)",
                          border: "1px solid var(--border, #ccc)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(v) => {
                          const n = typeof v === "number" ? v : v == null ? null : Number(v);
                          return n == null || Number.isNaN(n)
                            ? ["No entry", "Mood"]
                            : [
                                `${MOOD_LABEL[Math.round(n)]?.emoji} ${MOOD_LABEL[Math.round(n)]?.label} (${n.toFixed(1)})`,
                                "Mood",
                              ];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="mood"
                        stroke="#f97316"
                        strokeWidth={2.5}
                        fill="url(#moodFill)"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton className="h-full w-full rounded-xl" />
                )}
              </div>
            </section>

            {/* Distribution Bar Chart */}
            <section
              data-page-reveal
              className="rounded-[20px] border border-border bg-card p-5 sm:p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Mood Distribution</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Breakdown of logged feelings during {rangeMeta.label.toLowerCase()}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {stats.windowCount} check-in{stats.windowCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="h-56 w-full">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.dist}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(150, 150, 150, 0.2)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        stroke="currentColor"
                        opacity={0.6}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        stroke="currentColor"
                        opacity={0.6}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card, #fff)",
                          border: "1px solid var(--border, #ccc)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(val, name, item) => [
                          `${val} times (${item.payload.pct}%)`,
                          "Count",
                        ]}
                      />
                      <Bar dataKey="count" fill="#2dd4bf" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton className="h-full w-full rounded-xl" />
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Export Summary Modal */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Personal Insights Summary</DialogTitle>
            <DialogDescription>
              Review or download your private reflections and stats to keep for yourself or share with your doctor.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <textarea
              readOnly
              value={exportSummaryText}
              rows={10}
              className="w-full rounded-xl border border-border bg-muted/40 p-3 text-xs font-mono leading-relaxed outline-none"
            />
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={copyExportSummary}
              className="gap-1.5 font-semibold"
            >
              <CopyIcon className="h-4 w-4" /> Copy Text
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setExportOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={downloadExportSummary}
                className="gap-1.5 font-semibold"
              >
                <DownloadSimpleIcon className="h-4 w-4" /> Download .txt
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="h-full rounded-[20px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4 text-orb-terracotta" /> {label}
      </div>
      <p className="mt-2 text-[1.85rem] font-extrabold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
