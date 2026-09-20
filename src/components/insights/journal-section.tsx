import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  NotePencilIcon,
  TrashIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

import { AppCard, SectionHeading } from "@/components/app-page";
import { Orb } from "@/components/landing/playroom-orb";
import { Button } from "@/components/ui/button";
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  type JournalEntry,
} from "@/lib/mood.functions";

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
  const listFn = useServerFn(listJournalEntries);
  const createFn = useServerFn(createJournalEntry);
  const deleteFn = useServerFn(deleteJournalEntry);

  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: () => listFn(),
  });

  const createMut = useMutation({
    mutationFn: (text: string) => createFn({ data: { body: text } }),
    onSuccess: () => {
      setBody("");
      setOpen(false);
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
      const prev = qc.getQueryData<JournalEntry[]>(["journal-entries"]);
      qc.setQueryData<JournalEntry[]>(["journal-entries"], (old) =>
        (old ?? []).filter((e) => e.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["journal-entries"], ctx.prev);
      toast.error("Couldn't remove that entry");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      onEntrySaved?.();
    },
  });

  const canSave = body.trim().length > 0 && !createMut.isPending;

  return (
    <section data-page-reveal className="mt-6">
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
            <Orb tone="periwinkle" face="smile" gaze className="h-11 w-11 shrink-0" />
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
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your journal…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing written yet. Your entries will gather here, oldest kept, newest
          first.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((e) => (
            <li key={e.id} data-page-stagger>
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
                {e.title ? (
                  <p className="mt-2 text-base font-bold">{e.title}</p>
                ) : null}
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
