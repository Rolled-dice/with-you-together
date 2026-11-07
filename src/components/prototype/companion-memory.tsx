import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMemories as listMemoriesFn,
  createMemory as createMemoryFn,
  deleteMemory as deleteMemoryFn,
} from "@/lib/memories.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { DataError } from "@/components/feedback/load-state";
import { useIdentity } from "@/features/session/session-store";
import { getMyCompanionSummary, clearMyCompanionSummary } from "@/lib/companion-summary.functions";
export function CompanionMemoryCard() {
  const { userId } = useIdentity();
  const listFn = useServerFn(listMemoriesFn);
  const createFn = useServerFn(createMemoryFn);
  const deleteFn = useServerFn(deleteMemoryFn);
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const readSummary = useServerFn(getMyCompanionSummary);
  const clearSummary = useServerFn(clearMyCompanionSummary);
  const summary = useQuery({
    queryKey: ["companion-summary", userId],
    enabled: !!userId,
    queryFn: () => readSummary(),
  });
  const clearSummaryMut = useMutation({
    mutationFn: () => clearSummary(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["companion-summary", userId] });
      toast.success("Your continuity summary has been cleared.");
    },
    onError: () => toast.error("We could not clear the summary. Please try again."),
  });

  const {
    data: memories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["memories", userId],
    enabled: !!userId,
    queryFn: () => listFn(),
  });

  const addMut = useMutation({
    mutationFn: () => createFn({ data: { content } }),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Saved. The Companion will remember this.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memories"] });
      void qc.invalidateQueries({ queryKey: ["companion-summary", userId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card data-page-reveal className="rounded-brand border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base font-medium">Companion memory</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section className="space-y-3 rounded-2xl border border-border p-4">
          <h3 className="font-semibold">Your private continuity summary</h3>
          <p className="text-sm text-muted-foreground">
            A short summary helps Companion remember the thread between conversations. Only your
            account can access it. Clearing it starts fresh; future conversations may create a new
            summary.
          </p>
          {summary.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : summary.isError ? (
            <DataError retry={() => void summary.refetch()} />
          ) : (
            <p className="whitespace-pre-wrap text-sm">
              {summary.data?.summary || "No continuity summary yet."}
            </p>
          )}
          <Button
            variant="outline"
            disabled={!summary.data?.summary || clearSummaryMut.isPending}
            onClick={() => {
              if (
                confirm(
                  "Clear your continuity summary? Your conversation history and saved notes will remain.",
                )
              )
                clearSummaryMut.mutate();
            }}
          >
            Clear continuity summary
          </Button>
        </section>
        <p className="text-sm text-muted-foreground">
          Short notes you'd like the Companion to keep in mind, only you can see these.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="A note for Companion memory"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            placeholder="e.g. I use they/them. Walks help when I'm anxious."
            className="rounded-brand"
          />
          <Button
            onClick={() => addMut.mutate()}
            disabled={!content.trim() || addMut.isPending}
            className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
            {addMut.isPending ? <SpinnerGapIcon className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        {isError ? (
          <DataError retry={() => void refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-10 w-full rounded-brand" />
        ) : memories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No memories yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="flex-1">{m.content}</span>
                <button
                  type="button"
                  onClick={() => delMut.mutate(m.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
