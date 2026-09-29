import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "./db";

export const GUEST_COOKIE = "aurelia_guest";

/** Read the demo guest for server components (no cookie writing). */
export async function getUserToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value ?? null;
}

export async function findUserByToken(token: string | null) {
  if (!token) return null;
  return db.user.findUnique({ where: { token } });
}

/**
 * Route-handler helper: resolves or creates the demo guest and returns
 * { user, setCookie } — callers must set the cookie when told to.
 */
export async function ensureUser(): Promise<{
  userId: string;
  setCookie?: string;
}> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (token) {
    const existing = await db.user.findUnique({ where: { token } });
    if (existing) return { userId: existing.id };
  }
  const newToken = randomBytes(18).toString("base64url");
  const created = await db.user.create({ data: { token: newToken } });
  return {
    userId: created.id,
    setCookie: `${GUEST_COOKIE}=${newToken}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
  };
}

/* ---------- Loyalty ---------- */

export interface LoyaltySummary {
  completedNights: number;
  tier: "Silver" | "Gold" | "Platinum";
  nextTier: "Gold" | "Platinum" | null;
  nightsToNextTier: number;
  progress: number; // 0..1 toward next tier
  stayCount: number;
}

const TIERS = [
  { name: "Gold", nights: 10 },
  { name: "Platinum", nights: 25 },
] as const;

export function computeLoyalty(completedNights: number, stayCount: number): LoyaltySummary {
  if (completedNights >= TIERS[1].nights) {
    return {
      completedNights,
      tier: "Platinum",
      nextTier: null,
      nightsToNextTier: 0,
      progress: 1,
      stayCount,
    };
  }
  if (completedNights >= TIERS[0].nights) {
    return {
      completedNights,
      tier: "Gold",
      nextTier: "Platinum",
      nightsToNextTier: TIERS[1].nights - completedNights,
      progress:
        (completedNights - TIERS[0].nights) / (TIERS[1].nights - TIERS[0].nights),
      stayCount,
    };
  }
  return {
    completedNights,
    tier: "Silver",
    nextTier: "Gold",
    nightsToNextTier: TIERS[0].nights - completedNights,
    progress: completedNights / TIERS[0].nights,
    stayCount,
  };
}
