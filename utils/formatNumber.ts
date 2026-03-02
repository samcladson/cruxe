/**
 * formatNumber.ts
 *
 * Utility for formatting large game currencies or scores
 * consistently throughout the app.
 */

export function formatCompactNumber(number: number): string {
  if (number < 1000) return number.toString();

  // Uses native Intl to easily turn 1800 into 1.8K, 2000000 into 2M, etc.
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}
