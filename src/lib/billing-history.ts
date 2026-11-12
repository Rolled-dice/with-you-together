type BillingEvent = {
  event_type: string;
  amount_cents: number | null;
};

const CUSTOMER_EVENT_TYPES = new Set([
  "payment.succeeded",
  "payment.failed",
  "tier.started",
  "tier.ended",
  "tier.upgraded",
  "tier.downgraded",
]);

export function customerBillingEvents<T extends BillingEvent>(events: readonly T[]): T[] {
  return events.filter((event) => {
    if (!CUSTOMER_EVENT_TYPES.has(event.event_type)) return false;
    // The membership event already represents a zero-value trial activation.
    return event.event_type !== "payment.succeeded" || event.amount_cents !== 0;
  });
}
