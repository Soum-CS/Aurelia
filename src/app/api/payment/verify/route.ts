import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRazorpayCredentials } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/verify — HMAC signature check + booking confirmation.
 * A booking only becomes CONFIRMED here, after the Razorpay signature
 * verifies server-side. Duplicate callbacks are idempotent.
 */
export async function POST(request: NextRequest) {
  const creds = getRazorpayCredentials();
  if (!creds) {
    return NextResponse.json({ error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }
  const keySecret = creds.keySecret;

  let body: Record<string, string>;
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    await db.booking.updateMany({
      where: { paymentOrderId: razorpay_order_id },
      data: { paymentStatus: "SIGNATURE_INVALID", status: "PAYMENT_FAILED" },
    });
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  // idempotent confirm + inventory guard: count confirmed stays in the
  // window against dataset rooms_available before flipping to CONFIRMED.
  const booking = await db.booking.findUnique({ where: { paymentOrderId: razorpay_order_id } });
  if (!booking) return NextResponse.json({ error: "Unknown order." }, { status: 404 });

  if (booking.status === "CONFIRMED") {
    return NextResponse.json({ success: true, code: booking.code, alreadyConfirmed: true });
  }

  const { getDatasetHotel } = await import("@/lib/hotels/csv-provider");
  const hotel = await getDatasetHotel(booking.providerBookingId!);
  if (hotel) {
    const ci = booking.checkIn.toISOString().slice(0, 10);
    const co = booking.checkOut.toISOString().slice(0, 10);
    const overlapping = await db.booking.count({
      where: {
        providerBookingId: hotel.hotel_id,
        status: { in: ["PENDING_PAYMENT", "PAID", "CONFIRMED"] },
        checkIn: { lt: new Date(`${co}T11:00:00.000Z`) },
        checkOut: { gt: new Date(`${ci}T14:00:00.000Z`) },
      },
    });
    if (overlapping > hotel.rooms_available) {
      await db.booking.update({ where: { id: booking.id }, data: { status: "PAYMENT_FAILED", paymentStatus: "SOLD_OUT_AFTER_PAYMENT" } });
      return NextResponse.json({ error: "Sold out — refund will be initiated." }, { status: 409 });
    }
  }

  const updated = await db.booking.update({
    where: { id: booking.id },
    data: { paymentId: razorpay_payment_id, paymentStatus: "PAID", status: "CONFIRMED" },
  });

  return NextResponse.json({ success: true, code: updated.code, status: updated.status });
}