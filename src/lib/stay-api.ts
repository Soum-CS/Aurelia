import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { resolveHotelForBooking, ensureRoomWalletTxn } from "./stay";

/**
 * Shared guards for stay-scoped API routes.
 * Every route that mutates stay state passes through here — it proves the
 * booking exists and resolves the single hotel the guest is staying at
 * (guests can never order another hotel's services).
 *
 * The hotel MAY be null (dataset bookings whose property isn't in Aurelia's
 * catalog yet): wallet, bill, services and notifications still work —
 * dining/experiences/itinerary routes decide for themselves whether they
 * need a resolved property and surface a transparent state otherwise.
 */

export type StayContext =
  | {
      ok: true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      booking: any;
      hotel: Awaited<ReturnType<typeof db.hotel.findUnique>>;
    }
  | { ok: false; response: NextResponse };

export async function loadStayContext(code: string): Promise<StayContext> {
  const booking = await db.booking.findUnique({
    where: { code },
    include: { serviceRequests: true },
  });
  if (!booking) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Booking not found" }, { status: 404 }),
    };
  }
  if (!["CONFIRMED", "CHECKED_IN"].includes(booking.status)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This stay is not active." },
        { status: 409 },
      ),
    };
  }

  const hotel = await resolveHotelForBooking(booking);
  await ensureRoomWalletTxn(booking);

  return { ok: true, booking, hotel };
}

/** Staff/admin token guard — set ADMIN_TOKEN in .env.local to enable staff ops. */
export function isAdmin(request: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const provided =
    request.headers.get("x-admin-token") ??
    new URL(request.url).searchParams.get("admin_token");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && a.equals(b); // length-safe compare
}

export async function createWalletTxn(data: {
  bookingId: string;
  category: string;
  label: string;
  amountInr: number;
  taxInr?: number;
  source: string;
  sourceId?: string;
}): Promise<{ ref: string }> {
  const ref = `${data.category}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
  await db.walletTransaction.create({
    data: {
      ref,
      status: "PENDING",
      ...data,
      taxInr: data.taxInr ?? 0,
    },
  });
  return { ref };
}
