import { NextRequest, NextResponse } from "next/server";
import { createPaymentSignature, getRazorpayCredentials } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/simulate — Test-mode Razorpay simulation endpoint.
 * Returns valid signed payment responses or failure responses for test scenarios.
 */
export async function POST(request: NextRequest) {
  const creds = getRazorpayCredentials();
  if (!creds) {
    return NextResponse.json({ error: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

  let body: { orderId?: string; fail?: boolean };
  try {
    body = (await request.json()) as { orderId?: string; fail?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderId, fail } = body;
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  if (fail) {
    return NextResponse.json({
      razorpay_order_id: orderId,
      razorpay_payment_id: `pay_test_fail_${Date.now()}`,
      razorpay_signature: "invalid_test_signature_failure",
    });
  }

  const paymentId = `pay_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const signature = createPaymentSignature(orderId, paymentId);

  return NextResponse.json({
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  });
}
