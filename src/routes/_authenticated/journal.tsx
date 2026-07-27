import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
} from "@/lib/journal.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, BookHeart, Loader2, NotebookPen, Download, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { exportJournalToPdf } from "@/lib/journal-export";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — BesideU" },
      {
        name: "description",
        content: "Private journaling and mood check-ins, only you can see.",
      },
    ],
  }),
  component: JournalPage,
});

const MOODS = [
  { value: 1, label: "Rough", emoji: "😔" },
  { value: 2, label: "Low", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😌" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Bright", emoji: "😊" },
];

function JournalPage() {
  const listFn = useServerFn(listJournalEntries);
  const createFn = useServerFn(createJournalEntry);
  const deleteFn = useServerFn(deleteJournalEntry);
  const qc = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal"],
    queryFn: () => listFn(),
  });

  const [mood, setMood] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? entries.filter((e) => {
        const q = query.trim().toLowerCase();
        return (
          (e.title ?? "").toLowerCase().includes(q) ||
          (e.body ?? "").toLowerCase().includes(q)
        );
      })
    : entries;

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { mood, title, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal"] });
      setMood(null);
      setTitle("");
      setBody("");
      toast.success("Saved to your journal");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (entries.length === 0) {
      toast.info("No entries to export yet.");
      return;
    }
    try {
      setIsExporting(true);
      const { data: userData } = await supabase.auth.getUser();
      let displayName: string | null = null;
      if (userData.user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", userData.user.id)
          .maybeSingle();
        displayName = p?.display_name ?? null;
      }
      exportJournalToPdf(entries, { displayName });
      toast.success("Journal PDF downloaded");
    } catch (err) {
      toast.error((err as Error).message || "Couldn't export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <AppShell>
      <div className="pb-[calc(1rem_+_env(safe-area-inset-bottom))] md:pb-0">
        <PageHeader
          eyebrow="Journal"
          slogan="Your pages. Your pace."
          title="Just for you"
          description="A private space. Nothing here is shared with family or Listeners."
        >
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || isLoading || entries.length === 0}
            className="rounded-brand"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export PDF
          </Button>
        </PageHeader>


      <Card className="rounded-brand border-border bg-card animate-fade-up card-lift">
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              How are you, right now?
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value === mood ? null : m.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    mood === m.value
                      ? "border-brand-primary bg-brand-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span aria-hidden>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="j-title" className="text-xs uppercase tracking-wide text-muted-foreground">
              Title (optional)
            </Label>
            <Input
              id="j-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A word or a line to remember this by"
              className="rounded-brand"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="j-body" className="text-xs uppercase tracking-wide text-muted-foreground">
              What's on your mind?
            </Label>
            <Textarea
              id="j-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write freely. No one else will read this."
              className="min-h-32 rounded-brand"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || (!body.trim() && !title.trim() && mood == null)}
              className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
            >
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookHeart className="mr-2 h-4 w-4" />
              )}
              Save entry
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent entries</h2>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your entries…"
              className="rounded-brand pl-8"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="rounded-brand border-border bg-card">
                <CardContent className="flex flex-col gap-2 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          entries.length === 0 ? (
            <EmptyState
              icon={<NotebookPen className="h-5 w-5" />}
              title="Your journal is empty"
              description="Whatever you write above will land here — a soft, private record you can revisit anytime."
            />
          ) : (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No matches"
              description={`Nothing in your journal matches "${query}".`}
            />
          )
        ) : (
          filtered.map((e) => {
            const moodInfo = MOODS.find((m) => m.value === e.mood);
            const date = new Date(e.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
            return (
              <Card key={e.id} style={{ animationDelay: `${Math.min(filtered.indexOf(e), 6) * 60}ms` }} className="rounded-brand border-border bg-card animate-fade-up card-lift">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {moodInfo ? (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        <span aria-hidden>{moodInfo.emoji}</span>
                        {moodInfo.label}
                      </span>
                    ) : null}
                    <span>{date}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this entry?")) deleteMut.mutate(e.id);
                      }}
                      className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {e.title ? (
                    <h3 className="mb-1 text-sm font-medium">{e.title}</h3>
                  ) : null}
                  {e.body ? (
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{e.body}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
        </div>
      </div>
    </AppShell>
  );
}
