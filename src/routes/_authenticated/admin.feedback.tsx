import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  Bug,
  Filter,
  Flame,
  Headphones,
  Inbox,
  LifeBuoy,
  Lightbulb,
  Loader2,
  MessageSquareHeart,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import {
  isCurrentUserAdmin,
  listAdminFeedback,
  updateAdminFeedback,
  type AdminFeedbackRow,
  type FeedbackCategory,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/feedback-admin.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/feedback")({
  head: () => ({
    meta: [
      { title: "Product review · BesideU admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminFeedbackPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-red-600">Something went wrong: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

const CATEGORY_META: Record<FeedbackCategory, { label: string; Icon: typeof Bug; tone: string }> = {
  feature_request: { label: "Feature request", Icon: Lightbulb, tone: "bg-mint/40" },
  bug_report: { label: "Bug", Icon: Bug, tone: "bg-blush/50" },
  product_feedback: { label: "Product", Icon: MessageSquareHeart, tone: "bg-peach/60" },
  ai_feedback: { label: "AI Companion", Icon: Sparkles, tone: "bg-lilac/40" },
  listener_feedback: { label: "Listener", Icon: Headphones, tone: "bg-sage/40" },
  support: { label: "Support", Icon: LifeBuoy, tone: "bg-sunrise/40" },
};

const PRIORITY_META: Record<FeedbackPriority, { label: string; className: string; rank: number }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 border-red-200", rank: 0 },
  high: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-200", rank: 1 },
  normal: { label: "Normal", className: "bg-neutral-100 text-neutral-700 border-neutral-200", rank: 2 },
  low: { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200", rank: 3 },
};

const STATUS_META: Record<FeedbackStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-sky-100 text-sky-800 border-sky-200" },
  in_review: { label: "In review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  planned: { label: "Planned", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  archived: { label: "Archived", className: "bg-neutral-100 text-neutral-500 border-neutral-200" },
};

type CategoryFilter = FeedbackCategory | "all";
type PriorityFilter = FeedbackPriority | "all";
type StatusFilter = FeedbackStatus | "all" | "open";
type SortMode = "recent" | "priority" | "oldest";

function AdminFeedbackPage() {
  const adminCheck = useServerFn(isCurrentUserAdmin);
  const listFn = useServerFn(listAdminFeedback);
  const updateFn = useServerFn(updateAdminFeedback);
  const qc = useQueryClient();

  const roleQ = useQuery({
    queryKey: ["admin", "role-check"],
    queryFn: () => adminCheck({}),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["admin", "feedback"],
    queryFn: () => listFn({}),
    enabled: roleQ.data?.isAdmin === true,
    refetchOnWindowFocus: true,
  });

  const updateMut = useMutation({
    mutationFn: (input: {
      id: string;
      priority?: FeedbackPriority;
      triage_status?: FeedbackStatus;
      admin_notes?: string | null;
    }) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "feedback"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
  });

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");

  const rows = listQ.data?.rows ?? [];

  const counts = useMemo(() => {
    const c = { total: rows.length, new: 0, urgent: 0, open: 0 };
    for (const r of rows) {
      if (r.triage_status === "new") c.new += 1;
      if (r.priority === "urgent") c.urgent += 1;
      if (r.triage_status !== "resolved" && r.triage_status !== "archived") c.open += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (priority !== "all" && r.priority !== priority) return false;
      if (status === "open") {
        if (r.triage_status === "resolved" || r.triage_status === "archived") return false;
      } else if (status !== "all" && r.triage_status !== status) return false;
      if (q) {
        const hay = `${r.subject ?? ""} ${r.message} ${r.email ?? ""} ${r.page ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "priority") {
      list.sort((a, b) => {
        const pd = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
        if (pd !== 0) return pd;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (sort === "oldest") {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [rows, category, priority, status, query, sort]);

  if (roleQ.isLoading) {
    return <PageShell><Skeleton className="h-40 w-full rounded-2xl" /></PageShell>;
  }

  if (!roleQ.data?.isAdmin) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg rounded-3xl border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blush/50">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This dashboard is for the BesideU product team. Ask an owner to grant you the <code>admin</code> role.
          </p>
          <Button asChild variant="ghost" className="mt-4">
            <Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Internal</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Product review inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every submission from the feedback dialog lands here. Triage, prioritise, and act.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link>
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={counts.total} Icon={Inbox} tone="bg-mint/40" />
        <StatCard label="New" value={counts.new} Icon={AlertCircle} tone="bg-sky-100" />
        <StatCard label="Open" value={counts.open} Icon={Filter} tone="bg-peach/50" />
        <StatCard label="Urgent" value={counts.urgent} Icon={Flame} tone="bg-red-100" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-soft">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject, message, email…"
          className="h-9 min-w-[180px] flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-coral/40"
        />
        <FilterSelect value={category} onValueChange={(v) => setCategory(v as CategoryFilter)} placeholder="Category">
          <SelectItem value="all">All categories</SelectItem>
          {(Object.keys(CATEGORY_META) as FeedbackCategory[]).map((k) => (
            <SelectItem key={k} value={k}>{CATEGORY_META[k].label}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={priority} onValueChange={(v) => setPriority(v as PriorityFilter)} placeholder="Priority">
          <SelectItem value="all">All priorities</SelectItem>
          {(Object.keys(PRIORITY_META) as FeedbackPriority[]).map((k) => (
            <SelectItem key={k} value={k}>{PRIORITY_META[k].label}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={status} onValueChange={(v) => setStatus(v as StatusFilter)} placeholder="Status">
          <SelectItem value="open">Open (not resolved/archived)</SelectItem>
          <SelectItem value="all">All statuses</SelectItem>
          {(Object.keys(STATUS_META) as FeedbackStatus[]).map((k) => (
            <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={sort} onValueChange={(v) => setSort(v as SortMode)} placeholder="Sort">
          <SelectItem value="recent">Most recent</SelectItem>
          <SelectItem value="priority">Priority high → low</SelectItem>
          <SelectItem value="oldest">Oldest first</SelectItem>
        </FilterSelect>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing matches those filters. Try widening the status to "All" or clearing the search.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <FeedbackCard
              key={row.id}
              row={row}
              onChange={(patch) => updateMut.mutate({ id: row.id, ...patch })}
              saving={updateMut.isPending && updateMut.variables?.id === row.id}
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-peach/20">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: number;
  Icon: typeof Bug;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-soft">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-auto min-w-[150px] rounded-xl text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function FeedbackCard({
  row,
  onChange,
  saving,
}: {
  row: AdminFeedbackRow;
  onChange: (patch: {
    priority?: FeedbackPriority;
    triage_status?: FeedbackStatus;
    admin_notes?: string | null;
  }) => void;
  saving: boolean;
}) {
  const cat = CATEGORY_META[row.category];
  const [notes, setNotes] = useState(row.admin_notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const dirty = (notes ?? "") !== (row.admin_notes ?? "");

  return (
    <li className="rounded-2xl border bg-card p-4 shadow-soft transition hover:shadow-md">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cat.tone}`}>
          <cat.Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wider">
              {cat.label}
            </Badge>
            <Badge className={`rounded-full border text-[10px] uppercase tracking-wider ${PRIORITY_META[row.priority].className}`}>
              {PRIORITY_META[row.priority].label}
            </Badge>
            <Badge className={`rounded-full border text-[10px] uppercase tracking-wider ${STATUS_META[row.triage_status].className}`}>
              {STATUS_META[row.triage_status].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
            </span>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {row.subject && <h3 className="mt-1.5 font-semibold leading-snug">{row.subject}</h3>}
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{row.message}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {row.email && (
              <span>
                From <a className="underline underline-offset-2" href={`mailto:${row.email}`}>{row.email}</a>
              </span>
            )}
            {row.page && <span>Page: <code>{row.page}</code></span>}
            <span>Ref: <code>WU-{row.id.replace(/-/g, "").slice(0, 6).toUpperCase()}</code></span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Priority</span>
          <Select
            value={row.priority}
            onValueChange={(v) => onChange({ priority: v as FeedbackPriority })}
          >
            <SelectTrigger className="h-8 w-[110px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_META) as FeedbackPriority[]).map((k) => (
                <SelectItem key={k} value={k}>{PRIORITY_META[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</span>
          <Select
            value={row.triage_status}
            onValueChange={(v) => onChange({ triage_status: v as FeedbackStatus })}
          >
            <SelectTrigger className="h-8 w-[130px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_META) as FeedbackStatus[]).map((k) => (
                <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-8 rounded-lg text-xs"
          onClick={() => setNotesOpen((o) => !o)}
        >
          {notesOpen ? "Hide notes" : row.admin_notes ? "Notes ✎" : "Add notes"}
        </Button>
      </div>

      {notesOpen && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes — visible only to the product team."
            className="min-h-[80px] rounded-xl text-sm"
            maxLength={4000}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNotes(row.admin_notes ?? "")}
              disabled={!dirty}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={() => onChange({ admin_notes: notes.trim() ? notes : null })}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : "Save notes"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
