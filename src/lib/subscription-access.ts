export type SubscriptionState = {
  status: string;
  current_period_end: string | null;
  price_id: string;
  created_at: string;
  cancel_at_period_end?: boolean | null;
};

export function hasSubscriptionAccess(
  subscription: Pick<SubscriptionState, "status" | "current_period_end">,
  now = Date.now(),
): boolean {
  const end = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : null;
  if (end !== null && (!Number.isFinite(end) || end <= now)) return false;
  if (["active", "trialing", "past_due"].includes(subscription.status)) return true;
  return subscription.status === "canceled" && end !== null && end > now;
}

export function currentSubscription<T extends SubscriptionState>(
  subscriptions: readonly T[],
  now = Date.now(),
): T | null {
  const newestFirst = [...subscriptions].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  return newestFirst.find((row) => hasSubscriptionAccess(row, now)) ?? newestFirst[0] ?? null;
}
