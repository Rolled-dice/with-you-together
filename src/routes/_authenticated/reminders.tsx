import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { BellRing, Check, Loader2, Plus, Trash2 } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
} from "@/lib/reminders.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders · SomeoneNear" },
      {
        name: "description",
        content:
          "Gentle nudges for medicine, water, sleep and calling the people you love — set them once and SomeoneNear remembers.",
      },
      { property: "og:title", content: "Reminders · SomeoneNear" },
      {
        property: "og:description",
        content: "Set gentle daily reminders for medicine, water, rest and family calls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemindersPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Something went wrong: {error.message}</p>
    </AppShell>
  ),
});

const CATEGORIES = [
  { value: "general", label: "Medicine" },
  { value: "hydration", label: "Water" },
  { value: "exercise", label: "Move / rest" },
  { value: "appointment", label: "Appointment" },
  { value: "birthday", label: "Call someone" },
  { value: "other", label: "Something else" },
] as const;

const RECURRENCES = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
] as const;

function RemindersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReminders);
  const createFn = useServerFn(createReminder);
  const doneFn = useServerFn(completeReminder);
  const removeFn = useServerFn(deleteReminder);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [recurrence, setRecurrence] = useState<string>("daily");
  const [time, setTime] = useState("20:00");

  const reminders = useQuery({ queryKey: ["reminders"], queryFn: () => listFn() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reminders"] });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again");
      const [h, m] = time.split(":");
      const due = new Date();
      due.setHours(Number(h), Number(m ?? 0), 0, 0);
      if (due.getTime() < Date.now()) due.setDate(due.getDate() + 1);
      return createFn({
        data: {
          for_user_id: uid,
          title: title.trim(),
          category: category as never,
          recurrence: recurrence as never,
          due_at: due.toISOString(),
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      toast.success("Reminder saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: (id: string) => doneFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Nice — marked done");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = reminders.data ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reminders"
        title="Gentle nudges, set once"
        description="Medicine, water, rest, or a call home — SomeoneNear will remember for you."
      />

      <Card className="mb-6 rounded-brand border-border bg-card">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="reminder-title">
              What should we remind you about?
            </label>
            <Input
              id="reminder-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Blood pressure tablet"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Kind</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Time</span>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-[120px]"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Repeat</span>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!title.trim() || create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            Add
          </Button>
        </CardContent>
      </Card>

      {reminders.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No reminders yet"
          description="Add your first nudge above — medicine at 8pm, water at noon, a call home on Sunday."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r: any) => (
            <Card key={r.id} className="rounded-brand border-border bg-card">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {format(new Date(r.due_at), "EEE d MMM · h:mm a")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">
                      {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                    </Badge>
                    {r.recurrence && r.recurrence !== "none" && (
                      <Badge variant="outline">
                        {RECURRENCES.find((x) => x.value === r.recurrence)?.label ?? r.recurrence}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Mark done"
                    onClick={() => complete.mutate(r.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete reminder"
                    onClick={() => remove.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
