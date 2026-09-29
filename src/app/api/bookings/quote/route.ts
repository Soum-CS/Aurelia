import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nightsBetween } from "@/lib/format";
import { quotePrice } from "@/lib/pricing";
import { getUsdToInrRate, toINR } from "@/lib/currency";
import { getAvailableUnits } from "@/lib/data";
import { getProvider, providerStatus } from "@/lib/hotel-provider";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/quote — the server-side price recheck.
 *
 * The browser's numbers are advisory only; this endpoint re-derives the
 * authoritative quote (rate, addons, fees, taxes, availability) from our own
 * inventory and converts to INR at the current live rate. BookingFlow calls
 * it before confirming and surfaces any difference as a "Price updated"
 * prompt instead of silently booking a stale total.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roomTypeId = typeof body.roomTypeId === "string" ? body.roomTypeId : "";
  // Real bookings only: refuse to create records against non-existent inventory.
  if (!getProvider()) {
    return NextResponse.json(
      {
        error: "LIVE_CONNECTION_REQUIRED",
        message: "Live hotel data connection required.",
        requires: providerStatus().requires,
      },
      { status: 503 }
    );
  }

  const checkIn = typeof body.checkIn === "string" ? body.checkIn : "";
  const checkOut = typeof body.checkOut === "string" ? body.checkOut : "";
  const guests = Number(body.guests);
  const addonIds = Array.isArray(body.addons)
    ? body.addons.filter((a): a is string => typeof a === "string")
    : [];

  const nights = nightsBetween(checkIn, checkOut);
  if (!roomTypeId || nights < 1 || !Number.isInteger(guests) || guests < 1) {
    return NextResponse.json({ error: "roomTypeId, valid dates and guests are required." }, { status: 400 });
  }

  const room = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { basePrice: true, capacity: true },
  });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (guests > room.capacity) {
    return NextResponse.json({ error: "Too many guests for this room." }, { status: 400 });
  }

  const available = await getAvailableUnits(roomTypeId, checkIn, checkOut);
  const quote = quotePrice(room.basePrice, nights, Math.min(guests, room.capacity), addonIds);
  const rateInfo = await getUsdToInrRate();

  return NextResponse.json({
    quote: {
      rateUsd: quote.rate,
      roomsSubtotalUsd: quote.roomsSubtotal,
      addonsTotalUsd: quote.addonsTotal,
      serviceFeeUsd: quote.serviceFee,
      taxesFeesUsd: quote.taxesFees,
      totalUsd: quote.total,
      // INR snapshot at today's live rate
      totalInr: toINR(quote.total, rateInfo).convertedAmount,
      inrRate: rateInfo.rate,
      inrRateLive: rateInfo.live,
    },
    available,
    checkedAt: new Date().toISOString(),
  });
}
