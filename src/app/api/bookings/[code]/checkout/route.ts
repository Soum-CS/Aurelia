import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code },
    include: { serviceRequests: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (booking.status === "CHECKED_OUT") {
    return NextResponse.json({ alreadyCheckedOut: true, checkedOutAt: booking.checkedOutAt });
  }
  if (booking.status !== "CHECKED_IN") {
    return NextResponse.json(
      { error: "Check in before checking out." },
      { status: 409 }
    );
  }

  const extras = booking.serviceRequests.reduce((sum, r) => sum + r.price, 0);
  const checkedOutAt = new Date();

  await db.booking.update({
    where: { code },
    data: {
      status: "CHECKED_OUT",
      checkedOutAt,
      serviceRequests: {
        updateMany: { where: { status: { not: "RESOLVED" } }, data: { status: "RESOLVED" } },
      },
    },
  });

  return NextResponse.json({
    checkedOut: true,
    checkedOutAt: checkedOutAt.toISOString(),
    folioExtras: Math.round(extras * 100) / 100,
    grandTotal: Math.round((booking.total + extras) * 100) / 100,
  });
}
