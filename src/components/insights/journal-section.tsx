import { DataError } from "@/components/feedback/load-state";
import { assertIdentity, getIdentity, useIdentity } from "@/features/session/session-store";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { NotePencilIcon, TrashIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppCard, SectionHeading } from "@/components/app-page";
import { Button } from "@/components/ui/button";
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  type JournalEntry,
} from "@/lib/mood.functions";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, DrawSVGPlugin);

/**
 * A handwritten squiggle that draws itself on a loop, sitting where the orb
 * used to be. It reads as "writing" — the right cue for a journal — and the
 * pen nib rides the end of the line as it draws.
 *
 * Idle-only motion, so it obeys reduced motion: the ambient timeline is created
 * inside gsap.matchMedia's no-preference branch and simply isn't built
 * otherwise, leaving a static drawn line.
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
          // The nib rides the visible end of the stroke as it grows, stepping
          // through sampled points along the same path.
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
          // Erase by pushing the visible window off the end, then it loops.
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
      {/* A gently looping cursive stroke */}
      <path
        data-ink
        d="M8 30c4-10 7-10 9-4s3 10 6 4 4-14 7-9 3 12 5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pen nib that rides the drawing end */}
      <g data-nib className="text-orb-terracotta">
        <circle cx="0" cy="0" r="2.4" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Sample points along the ink path so the nib can trace it without MotionPath. */
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

const MOOD_EMOJI: Record<number, string> = {
  1: "😔",
  2: "😕",
  3: "😌",
  4: "🙂",
  5: "😊",
};

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
 *
 * Writes to the same `journal_entries` table as mood check-ins (a journal row
 * is one with a non-empty body), so a written entry also counts toward the
 * streak the charts already compute. The parent invalidates the mood-checkins
 * query on save so that stays in sync.
 */
export function JournalSection({ onEntrySaved }: { onEntrySaved?: () => void }) {
  const qc = useQueryClient();
  const identity = useIdentity();
  const journalKey = ["journal-entries", identity.userId] as const;
  const listFn = useServerFn(listJournalEntries);
  const createFn = useServerFn(createJournalEntry);
  const deleteFn = useServerFn(deleteJournalEntry);

  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);

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
  // The id of the entry just saved, so only that one gets the write-in animation
  // rather than the whole list re-animating on every refetch.
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
    mutationFn: (text: string) => createFn({ data: { body: text } }),
    onSuccess: (row) => {
      setBody("");
      setOpen(false);
      setJustSaved(row.id);
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      onEntrySaved?.();
      toast.success("Saved to your journal");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save that entry"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      // Optimistic: pull the row out immediately so deletion feels instant.
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
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      onEntrySaved?.();
    },
  });

  const canSave = body.trim().length > 0 && !createMut.isPending;

  return (
    <section data-page-reveal>
      <SectionHeading title="Journal" hint="Private to you" />

      <AppCard>
        {/* Composer. Collapsed to a single calm prompt until tapped, so the
            page doesn't open with a big empty textarea staring back. */}
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-4 text-left"
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
          <div>
            <label htmlFor="journal-body" className="sr-only">
              Journal entry
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LockSimpleIcon className="h-4 w-4" /> Only you can read this.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="rounded-full font-bold"
                  onClick={() => {
                    setBody("");
                    setOpen(false);
                  }}
                  disabled={createMut.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-full px-6 font-bold"
                  onClick={() => createMut.mutate(body)}
                  disabled={!canSave}
                >
                  {createMut.isPending ? "Saving…" : "Save entry"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppCard>

      {/* Entry list */}
      {isError ? (
        <DataError retry={() => void refetch()} />
      ) : isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your journal…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing written yet. Your entries will gather here, oldest kept, newest first.
        </p>
      ) : (
        <ul ref={listRef} className="mt-4 space-y-3">
          {entries.map((e) => (
            <li key={e.id} data-entry={e.id}>
              <AppCard className="group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <span>{formatWhen(e.created_at)}</span>
                    {e.mood != null && (
                      <span aria-hidden className="text-base leading-none">
                        {MOOD_EMOJI[e.mood]}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(e.id)}
                    aria-label="Delete this entry"
                    // Always reachable, not hover-only — hover-to-reveal fails
                    // on touch and is hard to hit with reduced motor control.
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                {e.title ? <p className="mt-2 text-base font-bold">{e.title}</p> : null}
                <p className="mt-1.5 whitespace-pre-wrap text-[1.0625rem] leading-relaxed text-foreground/90">
                  {e.body}
                </p>
              </AppCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
