import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getWhatsappActivity,
  retryWhatsappOutbox,
  simulateWhatsappInbound,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  component: AdminWhatsappPage,
  head: () => ({
    meta: [
      { title: "WhatsApp Bot Console · BesideU" },
      {
        name: "description",
        content:
          "Test the BesideU WhatsApp assistant, inspect conversations, and monitor the outbound message queue.",
      },
    ],
  }),
});

function AdminWhatsappPage() {
  const qc = useQueryClient();
  const load = useServerFn(getWhatsappActivity);
  const simulate = useServerFn(simulateWhatsappInbound);
  const retry = useServerFn(retryWhatsappOutbox);

  const [phone, setPhone] = useState("+919999900001");
  const [message, setMessage] = useState("hi");

  const q = useQuery({
    queryKey: ["admin", "whatsapp"],
    queryFn: () => load({}),
    refetchInterval: 15_000,
  });

  const send = useMutation({
    mutationFn: () => simulate({ data: { phone, body: message } }),
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
    },
    onError: (e: Error) => toast.error(e.message || "Simulation failed"),
  });

  const drain = useMutation({
    mutationFn: () => retry({ data: {} } as never),
    onSuccess: (res: { drained: number; provider: string | null }) => {
      toast.success(
        res.provider ? `Sent ${res.drained} queued message(s)` : "No provider connected yet",
      );
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
    },
  });

  const provider = q.data?.provider ?? null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="WhatsApp bot console"
        description="Drive the assistant with the simulator, watch every conversation, and keep an eye on the delivery queue."
      />

      <div className="mb-6 rounded-brand border border-border bg-surface p-4">
        <p className="text-sm">
          Provider:{" "}
          <span className={cn("font-medium", provider ? "text-brand-accent" : "text-amber-600")}>
            {provider ?? "none connected — replies stay queued"}
          </span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => drain.mutate()}
          disabled={drain.isPending}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry queued messages
        </Button>
      </div>

      <section className="mb-8 rounded-brand border border-border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="h-4 w-4 text-brand-accent" /> Simulator
        </h2>
        <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Try "hi", "1", "today", "4pm", "taken 1"'
            onKeyDown={(e) => {
              if (e.key === "Enter" && message.trim()) send.mutate();
            }}
          />
          <Button onClick={() => send.mutate()} disabled={send.isPending || !message.trim()}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Send
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Messages run through the real bot: linking, booking (2-hour lead time), medicine logging
          and prescription photos.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-brand border border-border bg-surface p-4">
          <h2 className="mb-3 text-base font-semibold">Conversation log</h2>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {(q.data?.messages ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
            {(q.data?.messages ?? []).map((m: any) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-brand border p-2.5 text-sm",
                  m.direction === "inbound"
                    ? "border-border bg-background"
                    : "border-brand-accent/30 bg-brand-accent/5",
                )}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>
                    {m.direction} · {m.phone}
                  </span>
                  <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{m.body ?? "(photo)"}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6">
          <section className="rounded-brand border border-border bg-surface p-4">
            <h2 className="mb-3 text-base font-semibold">Outbox</h2>
            <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {(q.data?.outbox ?? []).length === 0 && (
                <p className="text-muted-foreground">Nothing queued.</p>
              )}
              {(q.data?.outbox ?? []).map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-brand border border-border px-2.5 py-2"
                >
                  <span className="truncate">
                    {o.phone} · {o.kind}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      o.status === "sent"
                        ? "text-brand-accent"
                        : o.status === "failed"
                          ? "text-destructive"
                          : "text-amber-600",
                    )}
                  >
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-brand border border-border bg-surface p-4">
            <h2 className="mb-3 text-base font-semibold">Linked numbers</h2>
            <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {(q.data?.contacts ?? []).length === 0 && (
                <p className="text-muted-foreground">No numbers yet.</p>
              )}
              {(q.data?.contacts ?? []).map((c: any) => (
                <div
                  key={c.phone}
                  className="flex items-center justify-between gap-2 rounded-brand border border-border px-2.5 py-2"
                >
                  <span className="truncate">{c.phone}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.verified_at ? "verified" : "pending"}
                    {c.opted_in ? "" : " · opted out"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
