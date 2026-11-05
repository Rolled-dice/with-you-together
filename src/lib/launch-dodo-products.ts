// Verified Dodo test products only. Live product mappings are deliberately absent.
export const launchDodoTestCatalog = {
  catalogVersion: "2026-11-launch",
  environment: "test",
  products: {
    "in:care": "pdt_0NrCP2wWMAQ4DBGiI0fQd",
    "in:care_plus": "pdt_0NrCP30JKR7TTlZzbXoIb",
    "us:care": "pdt_0NrCP32BgW8m8TMWWsqcL",
    "us:care_plus": "pdt_0NrCP341kxj8S9iVhVywe",
    "gb:care": "pdt_0NrCP35xsZgpriwcSdehZ",
    "gb:care_plus": "pdt_0NrCP39dFExfyCDyvlVPZ",
    "eu:care": "pdt_0NrCP3BIlMc5Uo3yw5hO1",
    "eu:care_plus": "pdt_0NrCP3DALZEDjuaIWNJZU",
    "ca:care": "pdt_0NrCP3EstNVyam4zosPZ8",
    "ca:care_plus": "pdt_0NrCP3H14Xm1gsFpErudk",
    "au:care": "pdt_0NrCP3JJ7Wawmih15wsXf",
    "au:care_plus": "pdt_0NrCP3KxqFUdffhkDx69F",
    "pl:care": "pdt_0NrCP3MlfajGotV3n3dAQ",
    "pl:care_plus": "pdt_0NrCP3PaBsfHw1jkshj1x",
    "mx:care": "pdt_0NrCP3RGQrh5tTEyG1Qb4",
    "mx:care_plus": "pdt_0NrCP3U1B0BhTzrWYYTWI",
    "sg:care": "pdt_0NrCP3VfAJgFhwCdP3wWl",
    "sg:care_plus": "pdt_0NrCP3XKffy2QAmTm6KBf",
    "jp:care": "pdt_0NrCP3Z4htiTSJqb3VEgZ",
    "jp:care_plus": "pdt_0NrCP3anCxnvcmBYovbcI",
    "kr:care": "pdt_0NrCP3cOBTxs9OIaBczL8",
    "kr:care_plus": "pdt_0NrCP3e5x7KSm84obGX5W",
    "th:care": "pdt_0NrCP3gIhnhXGgOddaYtO",
    "th:care_plus": "pdt_0NrCP3i4zo43up24vVWsE",
    "kh:care": "pdt_0NrCP3jp1JBn89SiAB3J2",
    "kh:care_plus": "pdt_0NrCP3lVHMAC1w9XbLIvb",
    "ae:care": "pdt_0NrCP3n4jFKPLte02DRG1",
    "ae:care_plus": "pdt_0NrCP3ohBiOqfJW5Ti7jb",
    "sa:care": "pdt_0NrCP3qktD13Q1Uwljt8h",
    "sa:care_plus": "pdt_0NrCP3snoGKi8r0I8n8XD",
    "qa:care": "pdt_0NrCP3uheC4QDTqz6ZWgi",
    "qa:care_plus": "pdt_0NrCP3x6Uj0ykxJCMhIYm",
  },
  unsupported: {
    "kw:care": "Dodo test API rejects this currency",
    "kw:care_plus": "Dodo test API rejects this currency",
    "bh:care": "Dodo test API rejects this currency",
    "bh:care_plus": "Dodo test API rejects this currency",
    "om:care": "Dodo test API rejects this currency",
    "om:care_plus": "Dodo test API rejects this currency",
  },
  discount: {
    id: "dsc_0NrCPBNbEHZzPCcdOseGd",
    code: "SNLAUNCH30FIRST2026",
    subscriptionCycles: 1,
  },
} as const;
export function launchTestProductId(market: string, plan: string): string | null {
  const key = `${market}:${plan}`;
  return Object.hasOwn(launchDodoTestCatalog.products, key)
    ? launchDodoTestCatalog.products[key as keyof typeof launchDodoTestCatalog.products]
    : null;
}
