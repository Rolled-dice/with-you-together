export type DodoEnvironment = "test" | "live";

export const DODO_PRICE_IDS = [
  "care_monthly_inr",
  "care_monthly_usd",
  "care_plus_monthly_inr",
  "care_plus_monthly_usd",
] as const;

export type DodoPriceId = (typeof DODO_PRICE_IDS)[number];

type ServerEnvironment = Record<string, string | undefined>;

function serverEnvironment(): ServerEnvironment {
  return (
    (globalThis as typeof globalThis & { process?: { env?: ServerEnvironment } }).process?.env ?? {}
  );
}

function requireEnv(name: string): string {
  const value = serverEnvironment()[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getDodoEnvironment(): DodoEnvironment {
  const value = serverEnvironment().DODO_PAYMENTS_ENV?.trim().toLowerCase() || "test";
  if (value === "test" || value === "live") return value;
  throw new Error("DODO_PAYMENTS_ENV must be either 'test' or 'live'");
}

export function dodoBaseUrl(environment: DodoEnvironment): string {
  return environment === "test" ? "https://test.dodopayments.com" : "https://live.dodopayments.com";
}

function environmentVariable(environment: DodoEnvironment, suffix: string): string {
  return `DODO_${environment.toUpperCase()}_${suffix}`;
}

export function getDodoApiKey(environment: DodoEnvironment = getDodoEnvironment()): string {
  return requireEnv(environmentVariable(environment, "API_KEY"));
}

export function getDodoWebhookSecret(environment: DodoEnvironment = getDodoEnvironment()): string {
  return requireEnv(environmentVariable(environment, "WEBHOOK_SECRET"));
}

export function dodoProductIdForPrice(
  priceId: DodoPriceId,
  environment: DodoEnvironment = getDodoEnvironment(),
): string {
  const productVariables: Record<DodoPriceId, string> = {
    care_monthly_usd: "PRODUCT_CARE_USD",
    care_plus_monthly_usd: "PRODUCT_CARE_PLUS_USD",
    care_monthly_inr: "PRODUCT_CARE_INR",
    care_plus_monthly_inr: "PRODUCT_CARE_PLUS_INR",
  };

  return requireEnv(environmentVariable(environment, productVariables[priceId]));
}

export function isDodoPriceId(value: string): value is DodoPriceId {
  return (DODO_PRICE_IDS as readonly string[]).includes(value);
}
