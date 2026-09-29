import { NextRequest, NextResponse } from "next/server";
import { loadStayContext } from "@/lib/stay-api";
import { buildUnifiedBill, getWalletTxns } from "@/lib/stay";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/[code]/wallet — Aurelia Wallet.
 * Every charge on the stay as a referenced transaction, grouped by category,
 * with paid/pending split. The accommodation charge is materialized here so
 * the wallet always reconciles with the booking record.
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

  return NextResponse.json({
    hotel: { name: ctx.hotel?.name ?? ctx.booking.hotelName ?? "Your hotel" },
    transactions: txns.map((t) => ({
      ref: t.ref,
      category: t.category,
      label: t.label,
      amountInr: t.amountInr,
      taxInr: t.taxInr,
      status: t.status,
      source: t.source,
      createdAt: t.createdAt,
    })),
    summary: {
      subtotalInr: bill.subtotalInr,
      taxesIncludedInr: bill.taxesIncludedInr,
      paidInr: bill.paidInr,
      pendingInr: bill.pendingInr,
      grandTotalInr: bill.grandTotalInr,
    },
  });
}
