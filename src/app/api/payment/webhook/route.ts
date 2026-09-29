import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { awardBookingLoyaltyPoints } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing x-razorpay-signature header." }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: {
    entity?: string;
    event?: string;
    id?: string;
    payload?: Record<string, unknown>;
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const eventId = String(event.id ?? request.headers.get("x-razorpay-event-id") ?? "");
  const eventType = String(event.event ?? "");

  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Missing event id or type." }, { status: 400 });
  }

  // 1. Check idempotency: same event never applies twice
  const existing = await db.paymentEvent.findUnique({
    where: { eventId },
  });

  if (existing) {
    return NextResponse.json({ success: true, received: true, processed: false, duplicate: true, alreadyProcessed: true });
  }

  // 2. Extract entities from Razorpay webhook payload
  const paymentEntity = (event.payload as Record<string, Record<string, Record<string, unknown>>>)?.payment?.entity;
  const refundEntity = (event.payload as Record<string, Record<string, Record<string, unknown>>>)?.refund?.entity;
  const orderEntity = (event.payload as Record<string, Record<string, Record<string, unknown>>>)?.order?.entity;

  const paymentId = paymentEntity ? String(paymentEntity.id) : refundEntity ? String(refundEntity.payment_id) : null;
  const orderId = paymentEntity ? String(paymentEntity.order_id) : orderEntity ? String(orderEntity.id) : null;

  let bookingCode: string | null = null;

  // 3. Process event types
  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (orderId) {
      const booking = await db.booking.findUnique({
        where: { paymentOrderId: orderId },
      });

      if (booking) {
        bookingCode = booking.code;
        if (booking.status !== "CONFIRMED") {
          await db.booking.update({
            where: { id: booking.id },
            data: {
              paymentId: paymentId || booking.paymentId,
              paymentStatus: "PAID",
              status: "CONFIRMED",
            },
          });
        }
        // Award loyalty points for confirmed booking
        await awardBookingLoyaltyPoints(booking);
      }
    }
  } else if (eventType === "payment.failed") {
    if (orderId) {
      await db.booking.updateMany({
        where: { paymentOrderId: orderId, status: "PENDING_PAYMENT" },
        data: {
          paymentStatus: "FAILED",
          status: "PAYMENT_FAILED",
        },
      });
    }
  } else if (eventType === "refund.processed" || eventType === "refund.created") {
    if (paymentId) {
      const booking = await db.booking.findFirst({
        where: { paymentId },
      });
      if (booking) {
        bookingCode = booking.code;
        await db.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: "REFUNDED",
            status: "CANCELLED",
          },
        });
      }
    }
  }

  // 4. Record event in idempotency ledger
  await db.paymentEvent.create({
    data: {
      eventId,
      type: eventType,
      paymentId,
      orderId,
      bookingCode,
      payload: rawBody.slice(0, 4000),
    },
  });

  return NextResponse.json({ success: true, received: true, processed: true, eventId });
}
