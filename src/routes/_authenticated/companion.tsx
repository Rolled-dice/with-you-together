import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import { MessageCircleHeart, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/companion")({
  head: () => ({
    meta: [
      { title: "Companion — WithU" },
      { name: "description", content: "A calm AI Companion to talk things through, on your terms." },
    ],
  }),
  component: CompanionLayout,
});

function CompanionLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const deleteFn = useServerFn(deleteConversation);
  const params = useParams({ strict: false }) as { threadId?: string };

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listFn(),
  });

  const createMut = useMutation({
    mutationFn: () => createFn(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/companion/$threadId", params: { threadId: data.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (params.threadId === id) navigate({ to: "/companion" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh_-_9.75rem_-_env(safe-area-inset-bottom))] min-h-[32rem] gap-4 animate-fade-up md:h-[calc(100vh_-_6rem)] md:min-h-[36rem] md:gap-6">
        <aside className="hidden w-64 shrink-0 flex-col gap-3 md:flex">
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="rounded-brand bg-brand-primary text-primary-foreground hover:bg-brand-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New conversation
          </Button>
          <div className="flex-1 overflow-y-auto rounded-brand border border-border bg-card p-2">
            {conversations.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                Your conversations will appear here — always private.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {conversations.map((c) => {
                  const active = params.threadId === c.id;
                  return (
                    <li key={c.id} className="group relative">
                      <Link
                        to="/companion/$threadId"
                        params={{ threadId: c.id }}
                        className={cn(
                          "block truncate rounded-brand px-3 py-2 pr-8 text-sm transition-colors",
                          active
                            ? "bg-brand-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {c.title || "Untitled"}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm("Delete this conversation? This can't be undone.")) {
                            deleteMut.mutate(c.id);
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Not therapy or an emergency service. In a crisis, call or text 988 (US) or your local
            helpline.
          </p>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-brand border border-border bg-card card-lift animate-slide-in-up">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageCircleHeart className="h-4 w-4 text-brand-accent" />
            <h1 className="text-sm font-medium">Companion</h1>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto rounded-brand md:hidden"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> New
            </Button>
          </header>
          <Outlet />
        </section>
      </div>
    </AppShell>
  );
}
