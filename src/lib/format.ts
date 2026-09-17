/**
 * Compact number formatting for public-facing stat counters on the landing
 * page. Numbers below 1000 render verbatim; 1000+ collapse to a "k+" suffix
 * with a single decimal below 10k and rounded to a whole number at/above 10k.
 *
 * Pure and dependency-free so it can be unit-tested in isolation (the route
 * file it originally lived in is a TanStack route and not test-friendly).
 */
export function formatCount(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k+`;
  }
  return String(n);
}
