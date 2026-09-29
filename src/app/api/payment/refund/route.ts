import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { initiateRazorpayRefund, getRazorpayCredentials } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingCode = String(body.code ?? body.bookingCode ?? "").trim();
  const reason = String(body.reason ?? "Guest requested cancellation").slice(0, 300);

  if (!bookingCode) {
    return NextResponse.json({ error: "bookingCode is required." }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { code: bookingCode },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "Booking is already cancelled." }, { status: 409 });
  }

  const checkInTime = booking.checkIn.getTime();
  const now = Date.now();
  const hoursUntilCheckIn = (checkInTime - now) / (1000 * 60 * 60);

  // Cancellation policy tiers
  let refundPercentage = 0;
  let cancellationFeePercent = 100;

  if (hoursUntilCheckIn > 48) {
    refundPercentage = 100;
    cancellationFeePercent = 0;
  } else if (hoursUntilCheckIn > 24) {
    refundPercentage = 50;
    cancellationFeePercent = 50;
  } else {
    refundPercentage = 0;
    cancellationFeePercent = 100;
  }

  const totalPaidInr = booking.totalInr ?? Math.round(booking.total * 85);
  const refundAmountInr = Math.round((totalPaidInr * refundPercentage) / 100);
  const cancellationFeeInr = totalPaidInr - refundAmountInr;

  let gatewayRefundId: string | null = null;
  let refundStatus = "COMPLETED";

  // If paid via Razorpay and refund amount > 0, trigger gateway refund
  if (booking.paymentId && refundAmountInr > 0 && getRazorpayCredentials()) {
    try {
      const gatewayRes = await initiateRazorpayRefund(booking.paymentId, refundAmountInr, {
        booking_code: booking.code,
        reason,
      });
      gatewayRefundId = gatewayRes.id;
    } catch (err: unknown) {
      console.warn("Razorpay refund failed:", err);
      refundStatus = "FAILED";
    }
  }

  // Update booking
  await db.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      paymentStatus: refundAmountInr === totalPaidInr ? "REFUNDED" : refundAmountInr > 0 ? "PARTIALLY_REFUNDED" : "CANCELLED_NO_REFUND",
    },
  });

  // Record refund in wallet transaction ledger
  if (refundAmountInr > 0) {
    await db.walletTransaction.create({
      data: {
        bookingId: booking.id,
        ref: `TXN-REFUND-${booking.code}-${Date.now()}`,
        category: "ROOM",
        label: `Refund (${refundPercentage}% per cancellation policy)`,
        amountInr: -refundAmountInr,
        taxInr: 0,
        status: "REFUNDED",
        source: "MANUAL",
        sourceId: gatewayRefundId,
      },
    });
  }

  return NextResponse.json({
    success: true,
    bookingCode: booking.code,
    status: "CANCELLED",
    policy: {
      hoursUntilCheckIn: Math.round(hoursUntilCheckIn),
      refundPercentage,
      cancellationFeePercent,
      totalPaidInr,
      cancellationFeeInr,
      refundAmountInr,
      refundStatus,
      gatewayRefundId,
    },
  });
}
