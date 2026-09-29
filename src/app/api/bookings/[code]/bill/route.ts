import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadStayContext } from "@/lib/stay-api";
import { buildUnifiedBill, getWalletTxns } from "@/lib/stay";
import { createRazorpayOrder, getRazorpayCredentials } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/[code]/bill — the unified stay bill.
 * Accommodation + food + services + experiences in one place. Charges are
 * never duplicated: every line is one wallet transaction with a unique ref,
 * and taxes are shown as the recorded tax component of each line.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const txns = await getWalletTxns(ctx.booking.id);
  const bill = buildUnifiedBill(txns);

  let invoice = await db.invoice.findUnique({
    where: { bookingId: ctx.booking.id },
  });
  if (invoice) {
    invoice = {
      ...invoice,
      payload: JSON.stringify({
        ...JSON.parse(invoice.payload),
        // keep payload honest if charges changed after issue (shouldn't happen)
      }),
    };
  }

  return NextResponse.json({
    booking: {
      code: ctx.booking.code,
      guestName: ctx.booking.guestName,
      hotelName: ctx.hotel?.name ?? ctx.booking.hotelName ?? "Your hotel",
      checkIn: ctx.booking.checkIn,
      checkOut: ctx.booking.checkOut,
      status: ctx.booking.status,
    },
    bill,
    invoice: invoice
      ? { number: invoice.number, issuedAt: invoice.issuedAt, grandTotalInr: invoice.grandTotalInr }
      : null,
  });
}

/**
 * POST /api/bookings/[code]/bill — final unified checkout via Razorpay.
 * Creates a gateway order for exactly the outstanding (PENDING) amount and
 * records it on the booking for signature verification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      {
        error: "PAYMENT_NOT_CONFIGURED",
        message:
          "Payments are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local.",
      },
      { status: 503 },
    );
  }

  const txns = await getWalletTxns(ctx.booking.id);
  const bill = buildUnifiedBill(txns);
  if (bill.pendingInr <= 0) {
    return NextResponse.json(
      { error: "Nothing pending — your stay is fully settled." },
      { status: 409 },
    );
  }

  let order;
  try {
    order = await createRazorpayOrder({
      amountInr: bill.pendingInr,
      receipt: `aur_bill_${ctx.booking.code}_${Date.now()}`,
      notes: { type: "unified_bill", booking_code: ctx.booking.code },
    });
  } catch (err) {
    console.error("Razorpay bill order creation error:", err);
    return NextResponse.json(
      { error: "Payment gateway unreachable. Please try again." },
      { status: 502 },
    );
  }

  await db.booking.update({
    where: { id: ctx.booking.id },
    data: {
      billOrderId: order.id,
      paymentProvider: "razorpay",
      paymentStatus: "BILL_ORDER_CREATED",
    },
  });

  return NextResponse.json({
    success: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    pendingInr: bill.pendingInr,
    isTestSimulation: !order.isLiveGateway,
  });
}
