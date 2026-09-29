/**
 * Central currency service.
 *
 * Aurelia's internal amounts (seed data, addons, fees) are denominated in
 * USD; every user-facing price is presented in INR. Conversion uses a live
 * exchange-rate source and is cached; if the rate source is unreachable we
 * fall back to a pinned rate and FLAG it so callers never present a stale
 * guess as live truth.
 */

import { formatINR } from "./format";

export interface Money {
  originalAmount: number;
  originalCurrency: "USD";
  convertedAmount: number;
  displayCurrency: "INR";
  /** USD→INR rate applied. */
  rate: number;
  rateLive: boolean;
}

const RATE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_RATE = 88.5;

let cached: { at: number; rate: number } | null = null;

/**
 * Live USD→INR mid-market rate from open.er-api.com (free, no key).
 * Falls back to the pinned rate with rateLive=false when offline.
 */
export async function getUsdToInrRate(): Promise<{ rate: number; live: boolean }> {
  if (cached && Date.now() - cached.at < RATE_TTL_MS) {
    return { rate: cached.rate, live: true };
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = data.rates?.INR;
    if (data.result !== "success" || typeof rate !== "number" || rate <= 0) {
      throw new Error("bad FX payload");
    }
    cached = { at: Date.now(), rate };
    return { rate, live: true };
  } catch {
    return { rate: FALLBACK_RATE, live: false };
  }
}

/** Convert an internal USD amount into INR with full provenance. */
export function toINR(usdAmount: number, rateInfo: { rate: number; live: boolean }): Money {
  return {
    originalAmount: usdAmount,
    originalCurrency: "USD",
    convertedAmount: Math.round(usdAmount * rateInfo.rate),
    displayCurrency: "INR",
    rate: rateInfo.rate,
    rateLive: rateInfo.live,
  };
}

/** One-call display helper for internal USD amounts: ₹-formatted text. */
export function usdMoneyText(usdAmount: number, rateInfo: { rate: number; live: boolean }): string {
  return formatINR(toINR(usdAmount, rateInfo).convertedAmount);
}
