import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings/[code]/bill/verify — server-side Razorpay signature
 * verification for the unified bill payment. Only after a valid signature do
 * pending wallet transactions flip to PAID and the Invoice get issued.
 * Idempotent; a failed verification never fabricates success.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

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

  const booking = await db.booking.findUnique({ where: { code } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.billOrderId !== razorpay_order_id) {
    return NextResponse.json(
      { error: "Order does not match this stay." },
      { status: 400 },
    );
  }

  // already settled?
  const existingInvoice = await db.invoice.findUnique({
    where: { bookingId: booking.id },
  });
  if (existingInvoice && booking.paymentStatus === "BILL_PAID") {
    return NextResponse.json({
      success: true,
      alreadyPaid: true,
      invoiceNumber: existingInvoice.number,
    });
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    await db.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: "SIGNATURE_INVALID" },
    });
    return NextResponse.json(
      { error: "Payment signature verification failed. No charges were settled." },
      { status: 400 },
    );
  }

  const txns = await db.walletTransaction.findMany({
    where: { bookingId: booking.id, status: "PENDING" },
  });

  await db.$transaction([
    db.walletTransaction.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "PAID" },
    }),
    db.booking.update({
      where: { id: booking.id },
      data: { paymentId: razorpay_payment_id, paymentStatus: "BILL_PAID" },
    }),
  ]);

  // issue the invoice (idempotent)
  let invoice = existingInvoice;
  if (!invoice) {
    const txns2 = await db.walletTransaction.findMany({
      where: { bookingId: booking.id },
    });
    const grandTotalInr = txns2.reduce((s, t) => s + t.amountInr, 0);
    invoice = await db.invoice.create({
      data: {
        bookingId: booking.id,
        number: `INV-${booking.code.replace("AUR-", "")}`,
        payload: JSON.stringify({
          lines: txns2.map((t) => ({
            ref: t.ref,
            category: t.category,
            label: t.label,
            amountInr: t.amountInr,
            taxInr: t.taxInr,
            status: t.status,
          })),
        }),
        grandTotalInr,
      },
    });
  }

  if (txns.length > 0) {
    await db.notification.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        type: "system",
        title: `Bill settled · ${invoice.number}`,
        body: `₹${invoice.grandTotalInr.toLocaleString("en-IN")} paid. Your unified invoice is ready.`,
        href: `/trips/${code}/stay/wallet`,
        dedupeKey: `bill-paid-${booking.id}-${razorpay_payment_id}`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    invoiceNumber: invoice.number,
    settledTxns: txns.length,
  });
}
