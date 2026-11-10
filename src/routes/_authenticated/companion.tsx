import { DataError, DataSkeleton } from "@/components/feedback/load-state";
import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanionCalm } from "@/components/prototype/companion-calm";
import { CompanionMemoryCard } from "@/components/prototype/companion-memory";
import { toast } from "sonner";
import { useIdentity } from "@/features/session/session-store";

export const Route = createFileRoute("/_authenticated/companion")({
  head: () => ({
    meta: [
      { title: "Companion | SomeoneNear" },
      {
        name: "description",
        content: "A calm AI Companion to talk things through, on your terms.",
      },
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
  const { userId } = useIdentity();

  const {
    data: conversations = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => listFn(),
  });

  const createMut = useMutation({
    mutationFn: () => createFn(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations", userId] });
      navigate({ to: "/companion/$threadId", params: { threadId: data.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["conversations", userId] });
      if (params.threadId === id) navigate({ to: "/companion" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [tab, setTab] = useState("chat");
  return (
    <AppShell>
      <div className="sn-midnight-experience">
        <section className="sn-midnight-hero">
          <div>
            <div className="sn-midnight-badges">
              <span>🌙 An AI That’s Awake at 2am</span>
              <span>🔒 Private to You</span>
              <span>Your membership allowance applies</span>
            </div>
            <h1>Some nights the call is hours away. Your Companion is here for the quiet hours.</h1>
            <p>
              Warm, unhurried, and honest about what it is. Answer in a word, tap a thought, or skip
              a question. Pair your conversation with a quiet minute in Calm Space.
            </p>
          </div>
        </section>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="sn-midnight-tabs">
            <TabsTrigger value="chat">🌙 2am Companion</TabsTrigger>
            <TabsTrigger value="calm">🫧 Calm Space (Breathe &amp; Float)</TabsTrigger>
            <TabsTrigger value="memory">🔒 Memory &amp; Privacy</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" forceMount hidden={tab !== "chat"}>
            <div className="sn-midnight-chat-grid">
              <section className="sn-midnight-panel sn-midnight-chat">
                <header>
                  <span className="sn-companion-online" aria-hidden="true" />
                  <div>
                    <h2>Companion · Quiet Hours</h2>
                    <p>Private conversation — your Family Circle does not receive access.</p>
                  </div>
                  <button
                    className="sn-worker-secondary"
                    type="button"
                    disabled={createMut.isPending}
                    onClick={() => createMut.mutate()}
                  >
                    New conversation
                  </button>
                </header>
                <details className="sn-midnight-history">
                  <summary>Your conversations ({conversations.length})</summary>
                  {isPending ? (
                    <DataSkeleton />
                  ) : isError ? (
                    <DataError retry={() => void refetch()} />
                  ) : conversations.length ? (
                    <ul>
                      {conversations.map((conversation) => (
                        <li key={conversation.id}>
                          <Link
                            to="/companion/$threadId"
                            params={{ threadId: conversation.id }}
                            aria-current={params.threadId === conversation.id ? "page" : undefined}
                          >
                            {conversation.title || "Untitled conversation"}
                          </Link>
                          <button
                            type="button"
                            aria-label={`Delete conversation: ${conversation.title || "Untitled conversation"}`}
                            onClick={() => {
                              if (confirm("Delete this conversation? This cannot be undone."))
                                deleteMut.mutate(conversation.id);
                            }}
                          >
                            <TrashIcon size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Your conversations will appear here.</p>
                  )}
                </details>
                <Outlet />
              </section>
              <aside className="sn-midnight-aside">
                <section>
                  <span className="sn-worker-status">🫧 Need a Quiet Minute?</span>
                  <h2>
                    Breathe along with a slow circle, or name a worry and watch it float away.
                  </h2>
                  <p>Nothing saved — just a little room whenever a day feels heavy.</p>
                  <button type="button" className="sn-worker-button" onClick={() => setTab("calm")}>
                    Open Calm Space →
                  </button>
                </section>
                <section>
                  <span className="sn-worker-status">📞 Want a Real Human Voice?</span>
                  <h2>A warm listener, at your pace.</h2>
                  <p>Explore the listener roster and review your scheduled calls.</p>
                  <Link className="sn-worker-secondary" to="/listeners">
                    Connect with a Human Listener →
                  </Link>
                </section>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="calm" forceMount hidden={tab !== "calm"}>
            <CompanionCalm visible={tab === "calm"} />
          </TabsContent>
          <TabsContent value="memory">
            <section className="sn-midnight-panel sn-companion-memory">
              <span className="sn-worker-status">🔒 Companion Memory Controls</span>
              <h2>Your Stored Companion Notes &amp; Privacy Boundary</h2>
              <p>
                These notes belong to you. Family Circle membership does not grant access to your
                Companion conversations or personal memory.
              </p>
              <CompanionMemoryCard />
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
