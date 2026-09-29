import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadStayContext } from "@/lib/stay-api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const booking = ctx.booking;

  if (booking.status !== "CONFIRMED" && booking.status !== "CHECKED_IN") {
    return NextResponse.json(
      { error: "Digital room key is only available for confirmed or checked-in stays." },
      { status: 403 }
    );
  }

  let digitalKey = await db.digitalKey.findUnique({
    where: { bookingId: booking.id },
  });

  if (!digitalKey) {
    // Generate room number if not assigned
    const roomNum = booking.roomNumber || `Suite ${Math.floor(200 + Math.random() * 400)}`;
    const token = `AUR-KEY-${booking.code}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // Valid from check-in 14:00 to checkout 11:00
    const validFrom = new Date(booking.checkIn);
    validFrom.setHours(14, 0, 0, 0);

    const validUntil = new Date(booking.checkOut);
    validUntil.setHours(11, 0, 0, 0);

    digitalKey = await db.digitalKey.create({
      data: {
        bookingId: booking.id,
        keyToken: token,
        roomNumber: roomNum,
        guestName: booking.guestName,
        validFrom,
        validUntil,
        isActive: true,
      },
    });

    if (!booking.roomNumber) {
      await db.booking.update({
        where: { id: booking.id },
        data: { roomNumber: roomNum },
      });
    }
  }

  return NextResponse.json({
    id: digitalKey.id,
    bookingCode: booking.code,
    hotelName: ctx.hotel?.name ?? booking.hotelName ?? "Aurelia Luxury Hotel",
    roomName: booking.roomName ?? "Signature King Suite",
    roomNumber: digitalKey.roomNumber,
    guestName: digitalKey.guestName,
    keyToken: digitalKey.keyToken,
    validFrom: digitalKey.validFrom,
    validUntil: digitalKey.validUntil,
    isActive: digitalKey.isActive,
    lastUsedAt: digitalKey.lastUsedAt,
  });
}

/** Simulate contactless tap-to-unlock */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const key = await db.digitalKey.findUnique({
    where: { bookingId: ctx.booking.id },
  });

  if (!key || !key.isActive) {
    return NextResponse.json({ error: "Key not active." }, { status: 403 });
  }

  const updated = await db.digitalKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    unlocked: true,
    roomNumber: updated.roomNumber,
    timestamp: updated.lastUsedAt,
  });
}
