// Country -> currency + plan price lookup key.
// Falls back to USD when no explicit match.
//
// Two plans:
//   care      — $49 / ₹3,999 per month
//   care_plus — $79 / ₹6,499 per month (Most Chosen, unlimited Companion)

export type Currency = "inr" | "usd";
export type PlanId = "care" | "care_plus";

const INR_COUNTRIES = new Set(["IN"]);

export function currencyForCountry(country: string | null | undefined): Currency {
  if (!country) return "usd";
  return INR_COUNTRIES.has(country.toUpperCase()) ? "inr" : "usd";
}

export function priceIdFor(plan: PlanId, currency: Currency): string {
  return `${plan}_monthly_${currency}`;
}

export const PLAN_DISPLAY: Record<
  PlanId,
  {
    name: string;
    note: string;
    inrLabel: string;
    usdLabel: string;
    sessions: number;
    reschedules: number;
    members: number;
    highlight?: boolean;
    bullets: string[];
  }
> = {
  care: {
    name: "Care",
    note: "Individual membership, just for you",
    inrLabel: "₹3,999",
    usdLabel: "$49",
    sessions: 18,
    reschedules: 12,
    members: 1,
    bullets: [
      "18 Check-In calls a month",
      "15 minutes per call",
      "Your own private wellbeing space",
      "Companion chat with a daily message allowance",
    ],
  },
  care_plus: {
    name: "Care Plus",
    note: "For families sharing the care between them",
    inrLabel: "₹6,499",
    usdLabel: "$79",
    sessions: 30,
    reschedules: 20,
    members: 5,
    highlight: true,
    bullets: [
      "30 Check-In calls a month",
      "15 minutes per call",
      "Unlimited Companion chat, no daily cap",
      "Shared circle, up to 5 people",
      "On-demand Check-Ins when a day feels hard",
    ],
  },
};

export function displayPrice(plan: PlanId, currency: Currency): string {
  return currency === "inr" ? PLAN_DISPLAY[plan].inrLabel : PLAN_DISPLAY[plan].usdLabel;
}
