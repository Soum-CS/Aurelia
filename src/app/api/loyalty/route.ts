import { NextRequest, NextResponse } from "next/server";
import { getOrCreateLoyaltyAccount, LOYALTY_TIERS, LoyaltyTier } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "email query parameter is required." }, { status: 400 });
  }

  const account = await getOrCreateLoyaltyAccount(email);
  const tierInfo = LOYALTY_TIERS[account.tier as LoyaltyTier] ?? LOYALTY_TIERS.EXPLORER;

  return NextResponse.json({
    guestEmail: account.guestEmail,
    tier: account.tier,
    tierLabel: tierInfo.label,
    points: account.points,
    lifetimePoints: account.lifetimePoints,
    perks: tierInfo.perks,
    transactions: account.transactions,
  });
}
