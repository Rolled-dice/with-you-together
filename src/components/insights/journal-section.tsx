import { DataError } from "@/components/feedback/load-state";
import { assertIdentity, getIdentity, useIdentity } from "@/features/session/session-store";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  NotePencilIcon,
  TrashIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  SparkleIcon,
  XIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import { useRef, useState, useMemo } from "react";
import { toast } from "sonner";

import { AppCard, SectionHeading } from "@/components/app-page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  type JournalEntry,
} from "@/lib/mood.functions";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, DrawSVGPlugin);

/**
 * A handwritten squiggle that draws itself on a loop.
 */
function WritingMark() {
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const line = el.querySelector<SVGPathElement>("[data-ink]");
      const nib = el.querySelector<SVGGElement>("[data-nib]");
      if (!line) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.1 });
        tl.set(line, { drawSVG: "0%" })
          .set(nib, { autoAlpha: 1, x: NIB_PATH[0].x, y: NIB_PATH[0].y })
          .to(line, { drawSVG: "100%", duration: 1.6, ease: "power1.inOut" })
          .to(
            nib,
            {
              keyframes: { x: NIB_PATH.map((p) => p.x), y: NIB_PATH.map((p) => p.y) },
              duration: 1.6,
              ease: "power1.inOut",
            },
            "<",
          )
          .to(nib, { autoAlpha: 0, duration: 0.3 }, "-=0.1")
          .to(line, { drawSVG: "100% 100%", duration: 0.5, ease: "power1.in" }, "+=0.6");
        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <svg
      ref={root}
      viewBox="0 0 48 48"
      className="h-11 w-11 text-primary"
      role="presentation"
      aria-hidden="true"
    >
      <path
        data-ink
        d="M8 30c4-10 7-10 9-4s3 10 6 4 4-14 7-9 3 12 5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g data-nib className="text-orb-terracotta">
        <circle cx="0" cy="0" r="2.4" fill="currentColor" />
      </g>
    </svg>
  );
}

const NIB_PATH = [
  { x: 8, y: 30 },
  { x: 13, y: 22 },
  { x: 17, y: 26 },
  { x: 21, y: 28 },
  { x: 26, y: 20 },
  { x: 30, y: 23 },
  { x: 35, y: 30 },
  { x: 40, y: 30 },
];

const MOOD_DATA: Record<number, { label: string; emoji: string }> = {
  1: { label: "Rough", emoji: "😔" },
  2: { label: "Low", emoji: "😕" },
  3: { label: "Okay", emoji: "😌" },
  4: { label: "Good", emoji: "🙂" },
  5: { label: "Bright", emoji: "😊" },
};

const PROMPT_SUGGESTIONS = [
  { label: "☀️ Warmth", prompt: "What brought a little warmth or comfort today?" },
  { label: "🌿 Gratitude", prompt: "A small moment I felt quietly grateful for: " },
  { label: "💭 Letting Go", prompt: "Something that has been weighing on my thoughts: " },
  { label: "✨ Gentle Win", prompt: "A small step or win I took for myself today: " },
];

function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today · ${time}`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/**
 * Written journal, living inside Insights beside the mood charts.
 */
export function JournalSection({ onEntrySaved }: { onEntrySaved?: () => void }) {
  const qc = useQueryClient();
  const identity = useIdentity();
  const journalKey = ["journal-entries", identity.userId] as const;
  const listFn = useServerFn(listJournalEntries);
  const createFn = useServerFn(createJournalEntry);
  const deleteFn = useServerFn(deleteJournalEntry);

  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<number | "all">("all");

  // Editing state
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editMood, setEditMood] = useState<number | null>(null);

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: entries = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: journalKey,
    queryFn: () => listFn(),
  });

  const listRef = useRef<HTMLUListElement>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  useGSAP(
    () => {
      if (!justSaved) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = listRef.current?.querySelector(`[data-entry="${justSaved}"]`);
      if (el) {
        gsap.from(el, {
          autoAlpha: 0,
          y: -10,
          height: 0,
          marginBottom: 0,
          duration: 0.5,
          ease: "power3.out",
          clearProps: "height,marginBottom",
        });
      }
    },
    { dependencies: [justSaved], scope: listRef },
  );

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          body,
          title: title.trim() || undefined,
          mood: selectedMood ?? undefined,
        },
      }),
    onSuccess: (row) => {
      setBody("");
      setTitle("");
      setSelectedMood(null);
      setOpen(false);
      setJustSaved(row.id);
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      onEntrySaved?.();
      toast.success("Saved to your journal");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save that entry"),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editingEntry) throw new Error("No entry selected");
      await deleteFn({ data: { id: editingEntry.id } });
      return await createFn({
        data: {
          body: editBody,
          title: editTitle.trim() || undefined,
          mood: editMood ?? undefined,
        },
      });
    },
    onSuccess: (row) => {
      setEditingEntry(null);
      setJustSaved(row.id);
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      onEntrySaved?.();
      toast.success("Updated your reflection");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't update that entry"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["journal-entries"] });
      assertIdentity(identity.generation);
      const prev = qc.getQueryData<JournalEntry[]>(journalKey);
      qc.setQueryData<JournalEntry[]>(journalKey, (old) => (old ?? []).filter((e) => e.id !== id));
      return { prev, generation: identity.generation };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.generation !== getIdentity().generation) return;
      if (ctx?.prev) qc.setQueryData(journalKey, ctx.prev);
      toast.error("Couldn't remove that entry");
    },
    onSettled: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      onEntrySaved?.();
    },
  });

  const startEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditTitle(entry.title || "");
    setEditBody(entry.body);
    setEditMood(entry.mood);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (moodFilter !== "all" && e.mood !== moodFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inBody = e.body.toLowerCase().includes(q);
      const inTitle = (e.title || "").toLowerCase().includes(q);
      return inBody || inTitle;
    });
  }, [entries, searchQuery, moodFilter]);

  const canSave = body.trim().length > 0 && !createMut.isPending;
  const canSaveEdit = editBody.trim().length > 0 && !updateMut.isPending;

  return (
    <section data-page-reveal>
      <SectionHeading title="Journal & Reflections" hint="Private to you" />

      <AppCard>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-4 text-left transition hover:opacity-95"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <WritingMark />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold">Write something down</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                A sentence is plenty. No one else ever sees this.
              </span>
            </span>
            <NotePencilIcon className="ml-auto h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <div className="space-y-4">
            {/* Thought starters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt ideas:
              </span>
              {PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setBody((prev) => (prev ? `${prev}\n\n${s.prompt}` : s.prompt))}
                  className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-brand-primary/50 hover:bg-brand-primary/5"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="journal-title" className="sr-only">
                Title (optional)
              </label>
              <input
                id="journal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Give it a title (optional)..."
                className="mb-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none transition placeholder:text-muted-foreground/70 focus:border-primary"
              />

              <label htmlFor="journal-body" className="sr-only">
                Journal reflection
              </label>
              <textarea
                id="journal-body"
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={8000}
                placeholder="What's on your mind today? There's no wrong way to start."
                className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-base leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {/* Attach mood */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">How did you feel?</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((v) => {
                    const m = MOOD_DATA[v];
                    const active = selectedMood === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSelectedMood(active ? null : v)}
                        title={m.label}
                        className={`rounded-lg px-2 py-1 text-base transition ${
                          active
                            ? "bg-brand-primary/20 scale-110 shadow-sm border border-brand-primary/30"
                            : "hover:bg-muted/50 opacity-70 hover:opacity-100"
                        }`}
                      >
                        {m.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {body.length} / 8,000 characters
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LockSimpleIcon className="h-4 w-4" /> End-to-end private to your account.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="rounded-full font-bold"
                  onClick={() => {
                    setBody("");
                    setTitle("");
                    setSelectedMood(null);
                    setOpen(false);
                  }}
                  disabled={createMut.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-full px-6 font-bold"
                  onClick={() => createMut.mutate()}
                  disabled={!canSave}
                >
                  {createMut.isPending ? "Saving…" : "Save entry"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppCard>

      {/* Search and filters if entries exist */}
      {entries.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past reflections..."
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-8 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setMoodFilter("all")}
              className={`rounded-full px-3 py-1 font-medium transition ${
                moodFilter === "all"
                  ? "bg-brand-primary text-primary-foreground font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({entries.length})
            </button>
            {[1, 2, 3, 4, 5].map((v) => {
              const count = entries.filter((e) => e.mood === v).length;
              if (count === 0) return null;
              const active = moodFilter === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMoodFilter(active ? "all" : v)}
                  className={`rounded-full px-2.5 py-1 font-medium transition ${
                    active
                      ? "bg-brand-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {MOOD_DATA[v].emoji} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entry list */}
      {isError ? (
        <DataError retry={() => void refetch()} />
      ) : isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your journal…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing written yet. Your reflections will gather here, oldest kept, newest first.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No entries matched your search "{searchQuery}".
        </p>
      ) : (
        <ul ref={listRef} className="mt-4 space-y-3">
          {filteredEntries.map((e) => (
            <li key={e.id} data-entry={e.id}>
              <AppCard className="group transition hover:border-brand-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <span>{formatWhen(e.created_at)}</span>
                    {e.mood != null && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                        title={MOOD_DATA[e.mood]?.label}
                      >
                        <span aria-hidden>{MOOD_DATA[e.mood]?.emoji}</span>
                        <span>{MOOD_DATA[e.mood]?.label}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      aria-label="Edit this reflection"
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <PencilSimpleIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(e.id)}
                      aria-label="Delete this entry"
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {e.title ? <p className="mt-2 text-base font-bold text-foreground">{e.title}</p> : null}
                <p className="mt-1.5 whitespace-pre-wrap text-[1.0625rem] leading-relaxed text-foreground/90">
                  {e.body}
                </p>
              </AppCard>
            </li>
          ))}
        </ul>
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reflection</DialogTitle>
            <DialogDescription>
              Make adjustments to your thoughts or change the mood.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Title (optional)</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-primary"
                placeholder="Title..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Reflection</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
                maxLength={8000}
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Attached Mood</label>
              <div className="mt-1 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => {
                  const m = MOOD_DATA[v];
                  const active = editMood === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEditMood(active ? null : v)}
                      className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${
                        active
                          ? "bg-brand-primary text-primary-foreground font-semibold"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m.emoji} {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingEntry(null)} disabled={updateMut.isPending}>
              Cancel
            </Button>
            <Button onClick={() => updateMut.mutate()} disabled={!canSaveEdit}>
              {updateMut.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this reflection?</DialogTitle>
            <DialogDescription>
              This reflection will be permanently removed from your private journal. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingId(null)} disabled={deleteMut.isPending}>
              Keep Reflection
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMut.mutate(deletingId)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
