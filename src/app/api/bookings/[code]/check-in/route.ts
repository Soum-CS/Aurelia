import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function assignRoomNumber(code: string): string {
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const floor = 3 + (hash % 6);
  const unit = 1 + ((hash >> 3) % 11);
  return `${floor}${String(unit).padStart(2, "0")}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const booking = await db.booking.findUnique({ where: { code } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status === "CHECKED_IN") {
    return NextResponse.json(
      { roomNumber: booking.roomNumber, alreadyCheckedIn: true },
      { status: 200 }
    );
  }
  if (booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "This stay can no longer be checked in." }, { status: 409 });
  }

  const roomNumber = booking.roomNumber ?? assignRoomNumber(code);
  const checkedInAt = new Date();

  await db.booking.update({
    where: { code },
    data: { status: "CHECKED_IN", roomNumber, checkedInAt },
  });

  return NextResponse.json({
    checkedIn: true,
    roomNumber,
    keyIssuedAt: checkedInAt.toISOString(),
    roomStatus: "Ready — inspected by housekeeping",
    floor: Number(roomNumber[0]),
  });
}
