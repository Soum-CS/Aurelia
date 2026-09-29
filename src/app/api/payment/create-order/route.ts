import { NextRequest, NextResponse } from "next/server";
import { getDatasetHotel } from "@/lib/hotels/csv-provider";
import { isAvailableForStay } from "@/lib/hotels/csv-loader";
import { db } from "@/lib/db";
import { nightsBetween } from "@/lib/format";
import { ensureUser } from "@/lib/user";
import { createRazorpayOrder, getRazorpayCredentials, type RazorpayOrderResponse } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/create-order — server-authoritative order creation.
 * The browser never supplies an amount: hotel, dates, rooms and price are
 * validated against the configured dataset, then a Razorpay order is
 * created for the computed total (in paise).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const creds = getRazorpayCredentials();

  if (!creds) {
    return NextResponse.json(
      {
        error: "PAYMENT_NOT_CONFIGURED",
        message:
          "Payments are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local.",
      },
      { status: 503 }
    );
  }

  const keyId = creds.keyId;

  const hotelId = String(body.hotel_id ?? body.hotelId ?? "");
  const checkIn = String(body.check_in ?? body.checkIn ?? "");
  const checkOut = String(body.check_out ?? body.checkOut ?? "");
  const rooms = Math.max(1, Math.round(Number(body.rooms ?? 1)));
  const guests = Math.max(1, Math.round(Number(body.guests ?? 1)));

  const nights = nightsBetween(checkIn, checkOut);
  if (!hotelId || nights < 1) {
    return NextResponse.json(
      { error: "Valid hotel_id, check_in and check_out are required." },
      { status: 400 }
    );
  }

  const hotel = await getDatasetHotel(hotelId);
  if (!hotel) return NextResponse.json({ error: "Hotel not found." }, { status: 404 });

  if (!isAvailableForStay(hotel, checkIn, checkOut, rooms)) {
    if (rooms > hotel.rooms_available) {
      return NextResponse.json(
        {
          error: `Only ${hotel.rooms_available} ${
            hotel.rooms_available === 1 ? "room is" : "rooms are"
          } currently available.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: `This stay is outside the availability window (${
          hotel.available_from
        } → ${hotel.available_to}).`,
      },
      { status: 409 }
    );
  }

  // §19 — amount computed server-side only.
  const totalInr = hotel.price_per_night_inr * nights * rooms;

  // create Razorpay order (TEST or LIVE per dashboard keys)
  let order: RazorpayOrderResponse;
  try {
    order = await createRazorpayOrder({
      amountInr: totalInr,
      receipt: `aur_${hotelId}_${Date.now()}`,
      notes: {
        hotel_id: hotelId,
        check_in: checkIn,
        check_out: checkOut,
        rooms: String(rooms),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Payment gateway error.";
    return NextResponse.json(
      { error: "Payment gateway rejected the order.", detail: msg },
      { status: 502 }
    );
  }

  // persist an intent row so verification can find it even pre-checkout.
  // The booking is attached to the guest session so MY AURELIA STAY lists it.
  const { userId, setCookie } = await ensureUser();
  const created = await db.booking.create({
    data: {
      code: `AUR-${order.id.slice(-8).toUpperCase()}`,
      roomTypeId: null,
      userId,
      guestName: String(body.guest_name ?? body.guestName ?? "Guest"),
      guestEmail: String(body.guest_email ?? body.guestEmail ?? ""),
      guestPhone: body.guest_phone ? String(body.guest_phone) : null,
      checkIn: new Date(`${checkIn}T14:00:00.000Z`),
      checkOut: new Date(`${checkOut}T11:00:00.000Z`),
      nights,
      guests,
      addons: "[]",
      subtotal: totalInr,
      taxesFees: 0,
      total: totalInr,
      currency: "INR",
      totalInr,
      inrRateUsed: null,
      provider: "csv-dataset",
      providerBookingId: hotelId,
      destinationLabel: `${hotel.city}, ${hotel.state}`,
      hotelName: hotel.name,
      roomName: hotel.room_type,
      pricePerNight: hotel.price_per_night_inr,
      paymentProvider: "razorpay",
      paymentOrderId: order.id,
      paymentStatus: "CREATED",
      status: "PENDING_PAYMENT",
    },
  });

  const response = NextResponse.json({
    success: true,
    orderId: order.id,
    amount: order.amount, // paise
    currency: order.currency,
    keyId, // public id only — safe for Checkout
    code: created.code,
    isLiveGateway: Boolean(order.isLiveGateway),
    isTestSimulation: order.id.startsWith("order_test_") || keyId === "rzp_test_aurelia2026",
    summary: {
      hotel: hotel.name,
      roomType: hotel.room_type,
      checkIn,
      checkOut,
      nights,
      rooms,
      pricePerNightInr: hotel.price_per_night_inr,
      totalInr,
    },
  });
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}