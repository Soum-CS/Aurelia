/**
 * Indian Rupee formatting with en-IN lakh/crore grouping — ₹1,25,000.
 * Internal amounts are USD-denominated: convert via src/lib/currency.ts
 * (toINR / usdMoneyText) BEFORE formatting. There is deliberately no
 * formatCurrency(USD) passthrough left anywhere.
 */
export function formatINR(amountInInr: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amountInInr || 0)));
}

export function formatDate(iso: Date | string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDistance(km?: number | null): string {
  if (km == null || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`;
  return `${km.toFixed(1)} km away`;
}
