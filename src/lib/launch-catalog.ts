export const LAUNCH_CATALOG_VERSION = "2026-11-launch" as const;
export type LaunchPlan = "care" | "care_plus";
export const LAUNCH_PLANS = {
  care: { name: "Care", calls: 15, people: 2, trialCalls: 4 },
  care_plus: { name: "Care Plus", calls: 30, people: 5, trialCalls: 7 },
} as const;
export const SHARED_LAUNCH_FEATURES = [
  "Companion conversations",
  "Family circle and shared updates",
  "Medication and personal reminders",
  "Private memories and scheduled messages",
  "ASSIST and calm audio",
] as const;

// Fixed market prices in currency minor units, as approved for the launch.
// USD is deliberately offered at different prices in Cambodia and the US.
export const LAUNCH_MARKETS = [
  {
    id: "in",
    name: "India",
    currency: "INR",
    prefix: "₹",
    digits: 2,
    care: 300000,
    care_plus: 500000,
  },
  {
    id: "us",
    name: "United States",
    currency: "USD",
    prefix: "$",
    digits: 2,
    care: 4900,
    care_plus: 7900,
  },
  {
    id: "gb",
    name: "United Kingdom",
    currency: "GBP",
    prefix: "£",
    digits: 2,
    care: 3900,
    care_plus: 6200,
  },
  {
    id: "eu",
    name: "Eurozone",
    currency: "EUR",
    prefix: "€",
    digits: 2,
    care: 4500,
    care_plus: 7200,
  },
  {
    id: "ca",
    name: "Canada",
    currency: "CAD",
    prefix: "C$",
    digits: 2,
    care: 6500,
    care_plus: 10500,
  },
  {
    id: "au",
    name: "Australia",
    currency: "AUD",
    prefix: "A$",
    digits: 2,
    care: 7500,
    care_plus: 11900,
  },
  {
    id: "pl",
    name: "Poland",
    currency: "PLN",
    prefix: "zł",
    digits: 2,
    care: 17900,
    care_plus: 28900,
  },
  {
    id: "mx",
    name: "Mexico",
    currency: "MXN",
    prefix: "MX$",
    digits: 2,
    care: 49900,
    care_plus: 79900,
  },
  {
    id: "sg",
    name: "Singapore",
    currency: "SGD",
    prefix: "S$",
    digits: 2,
    care: 6500,
    care_plus: 10500,
  },
  { id: "jp", name: "Japan", currency: "JPY", prefix: "¥", digits: 0, care: 5900, care_plus: 9500 },
  {
    id: "kr",
    name: "South Korea",
    currency: "KRW",
    prefix: "₩",
    digits: 0,
    care: 59000,
    care_plus: 95000,
  },
  {
    id: "th",
    name: "Thailand",
    currency: "THB",
    prefix: "฿",
    digits: 2,
    care: 129000,
    care_plus: 209000,
  },
  {
    id: "kh",
    name: "Cambodia",
    currency: "USD",
    prefix: "US$",
    digits: 2,
    care: 2500,
    care_plus: 3900,
  },
  {
    id: "ae",
    name: "UAE",
    currency: "AED",
    prefix: "AED ",
    digits: 2,
    care: 17900,
    care_plus: 28900,
  },
  {
    id: "sa",
    name: "Saudi Arabia",
    currency: "SAR",
    prefix: "SAR ",
    digits: 2,
    care: 17900,
    care_plus: 29900,
  },
  {
    id: "qa",
    name: "Qatar",
    currency: "QAR",
    prefix: "QAR ",
    digits: 2,
    care: 17900,
    care_plus: 29900,
  },
  {
    id: "kw",
    name: "Kuwait",
    currency: "KWD",
    prefix: "KWD ",
    digits: 3,
    care: 14900,
    care_plus: 23900,
  },
  {
    id: "bh",
    name: "Bahrain",
    currency: "BHD",
    prefix: "BHD ",
    digits: 3,
    care: 17000,
    care_plus: 27000,
  },
  {
    id: "om",
    name: "Oman",
    currency: "OMR",
    prefix: "OMR ",
    digits: 3,
    care: 18000,
    care_plus: 29000,
  },
] as const;
export type MarketId = (typeof LAUNCH_MARKETS)[number]["id"];
export function isMarketId(value: unknown): value is MarketId {
  return LAUNCH_MARKETS.some((market) => market.id === value);
}
export function launchMarket(id: MarketId) {
  const market = LAUNCH_MARKETS.find((entry) => entry.id === id);
  if (!market) throw new Error("Unsupported launch market.");
  return market;
}
// Euro-area membership checked against the EU country list, November 2026.
const euroCountries = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
]);
export function marketForCountry(country?: string | null): MarketId {
  const normalized = country?.trim().toUpperCase() ?? "";
  if (euroCountries.has(normalized)) return "eu";
  const id = normalized.toLowerCase();
  return isMarketId(id) ? id : "us";
}
export function launchPrice(plan: LaunchPlan, marketId: MarketId, firstPaidMonth = false) {
  const market = launchMarket(marketId);
  const amount = firstPaidMonth ? Math.round((market[plan] * 70) / 100) : market[plan];
  return `${market.prefix}${new Intl.NumberFormat("en-US", { maximumFractionDigits: market.digits }).format(amount / 10 ** market.digits)}`;
}
export function launchPriceKey(plan: LaunchPlan, marketId: MarketId) {
  return `${LAUNCH_CATALOG_VERSION}:${marketId}:${plan}`;
}
export function refundDeadline(firstSuccessfulChargeAt: string): string {
  const instant = Date.parse(firstSuccessfulChargeAt);
  if (!Number.isFinite(instant)) throw new Error("A successful charge timestamp is required.");
  return new Date(instant + 7 * 24 * 60 * 60 * 1000).toISOString();
}
