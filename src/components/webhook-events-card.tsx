import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowClockwiseIcon, CheckCircleIcon, WarningCircleIcon, ClockIcon } from "@phosphor-icons/react";

type Row = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  environment: string;
  processed: boolean;
  error: string | null;
  received_at: string;
  processed_at: string | null;
  stripe_subscription_id: string | null;
};

export function WebhookEventsCard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    const { data } = await supabase
      .from("stripe_webhook_events")
      .select("*")
      .eq("user_id", userId)
      .order("received_at", { ascending: false })
      .limit(20);
    setRows((data as Row[]) ?? []);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("swe:" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stripe_webhook_events", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Payment webhook activity</CardTitle>
          <CardDescription>
            Verify webhooks are firing and backfills are applied. Updates live.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={refreshing}>
          <ArrowClockwiseIcon className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhook events yet. They will appear here as your payment provider fires them.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2 flex items-start gap-3 text-sm">
                <div className="mt-0.5">
                  {r.error ? (
                    <WarningCircleIcon className="h-4 w-4 text-destructive" />
                  ) : r.processed ? (
                    <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{r.event_type}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {r.environment}
                    </Badge>
                    {r.error && (
                      <Badge variant="destructive" className="text-[10px]">error</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.received_at).toLocaleString()} · {r.stripe_event_id}
                  </div>
                  {r.error && (
                    <p className="text-xs text-destructive mt-1 break-words">{r.error}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
