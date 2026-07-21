// Country -> currency + plan price lookup key.
// Falls back to USD when no explicit match.

export type Currency = "inr" | "usd";
export type PlanId = "together" | "family" | "care";

const INR_COUNTRIES = new Set(["IN"]);

export function currencyForCountry(country: string | null | undefined): Currency {
  if (!country) return "usd";
  return INR_COUNTRIES.has(country.toUpperCase()) ? "inr" : "usd";
}

export function priceIdFor(plan: PlanId, currency: Currency): string {
  return `${plan}_monthly_${currency}`;
}

export const PLAN_DISPLAY: Record<PlanId, {
  name: string;
  inrLabel: string;
  usdLabel: string;
  members: number;
  sessions: number;
  reschedules: number;
  bullets: string[];
}> = {
  together: {
    name: "Together",
    inrLabel: "₹799",
    usdLabel: "$8.99",
    members: 1,
    sessions: 4,
    reschedules: 4,
    bullets: [
      "AI Companion, Mood, Journal",
      "4 Human Listener sessions / month",
      "4 free reschedules",
      "1 member",
    ],
  },
  family: {
    name: "Family",
    inrLabel: "₹1,499",
    usdLabel: "$17.99",
    members: 3,
    sessions: 12,
    reschedules: 8,
    bullets: [
      "Everything in Together",
      "Family dashboard & shared check-ins",
      "12 Human Listener sessions / month",
      "Owner allocates freely across up to 3 members",
      "8 free reschedules",
    ],
  },
  care: {
    name: "Care",
    inrLabel: "₹3,499",
    usdLabel: "$41.99",
    members: 4,
    sessions: 24,
    reschedules: 12,
    bullets: [
      "Everything in Family",
      "Priority booking",
      "24 Human Listener sessions / month",
      "Owner allocates freely across up to 4 members",
      "12 free reschedules",
    ],
  },
};

export function displayPrice(plan: PlanId, currency: Currency): string {
  return currency === "inr" ? PLAN_DISPLAY[plan].inrLabel : PLAN_DISPLAY[plan].usdLabel;
}
