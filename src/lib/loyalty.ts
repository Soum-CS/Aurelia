import { db } from "./db";

export type LoyaltyTier = "EXPLORER" | "VOYAGER" | "ELITE" | "SIGNATURE";

export interface TierInfo {
  tier: LoyaltyTier;
  label: string;
  minPoints: number;
  multiplier: number;
  perks: string[];
}

export const LOYALTY_TIERS: Record<LoyaltyTier, TierInfo> = {
  EXPLORER: {
    tier: "EXPLORER",
    label: "Aurelia Explorer",
    minPoints: 0,
    multiplier: 1.0,
    perks: ["Complimentary high-speed WiFi", "Welcome drink on arrival", "Member-only room rates"],
  },
  VOYAGER: {
    tier: "VOYAGER",
    label: "Aurelia Voyager",
    minPoints: 5000,
    multiplier: 1.25,
    perks: ["1.25× Points on stays & dining", "Early check-in priority (from 12:00)", "Spa 15% discount"],
  },
  ELITE: {
    tier: "ELITE",
    label: "Aurelia Elite",
    minPoints: 15000,
    multiplier: 1.5,
    perks: ["1.5× Points", "Complimentary late checkout (until 16:00)", "Room upgrade upon availability", "VIP airport lounge access"],
  },
  SIGNATURE: {
    tier: "SIGNATURE",
    label: "Aurelia Signature",
    minPoints: 40000,
    multiplier: 2.0,
    perks: ["2× Points", "Guaranteed room upgrade", "Dedicated 24/7 Butler concierge", "Chilled welcome vintage champagne", "Complimentary luxury airport transfer"],
  },
};

export function calculateTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 40000) return "SIGNATURE";
  if (lifetimePoints >= 15000) return "ELITE";
  if (lifetimePoints >= 5000) return "VOYAGER";
  return "EXPLORER";
}

export async function getOrCreateLoyaltyAccount(guestEmail: string, userId?: string | null) {
  const normalizedEmail = guestEmail.toLowerCase().trim();
  let account = await db.loyaltyAccount.findUnique({
    where: { guestEmail: normalizedEmail },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!account) {
    account = await db.loyaltyAccount.create({
      data: {
        guestEmail: normalizedEmail,
        userId: userId ?? null,
        tier: "EXPLORER",
        points: 500, // 500 points welcome bonus!
        lifetimePoints: 500,
      },
      include: {
        transactions: true,
      },
    });

    await db.rewardTransaction.create({
      data: {
        accountId: account.id,
        points: 500,
        reason: "WELCOME_BONUS",
        ref: `REW-WELCOME-${Date.now()}`,
      },
    });
  }

  return account;
}

export async function awardBookingLoyaltyPoints(booking: {
  code: string;
  guestEmail: string;
  userId?: string | null;
  totalInr?: number | null;
  total: number;
}) {
  const email = booking.guestEmail.toLowerCase().trim();
  const account = await getOrCreateLoyaltyAccount(email, booking.userId);

  // Check if booking already rewarded
  const alreadyRewarded = await db.rewardTransaction.findFirst({
    where: {
      accountId: account.id,
      bookingCode: booking.code,
      reason: "BOOKING_REWARD",
    },
  });

  if (alreadyRewarded) return;

  const currentTierInfo = LOYALTY_TIERS[account.tier as LoyaltyTier] ?? LOYALTY_TIERS.EXPLORER;
  const spentInr = booking.totalInr ?? Math.round(booking.total * 85);
  // 10 points per ₹100 spent, multiplied by tier multiplier
  const basePoints = Math.round((spentInr / 100) * 10);
  const earnedPoints = Math.round(basePoints * currentTierInfo.multiplier);

  const updatedLifetime = account.lifetimePoints + earnedPoints;
  const newTier = calculateTier(updatedLifetime);

  await db.$transaction([
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: account.points + earnedPoints,
        lifetimePoints: updatedLifetime,
        tier: newTier,
      },
    }),
    db.rewardTransaction.create({
      data: {
        accountId: account.id,
        points: earnedPoints,
        reason: "BOOKING_REWARD",
        bookingCode: booking.code,
        ref: `REW-BKG-${booking.code}-${Date.now()}`,
      },
    }),
  ]);
}
