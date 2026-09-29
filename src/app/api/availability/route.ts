import { NextRequest, NextResponse } from "next/server";
import { getAvailableUnits } from "@/lib/data";
import { nightsBetween } from "@/lib/format";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const roomTypeId = sp.get("roomTypeId");
  const checkIn = sp.get("checkIn") ?? "";
  const checkOut = sp.get("checkOut") ?? "";

  if (!roomTypeId || nightsBetween(checkIn, checkOut) <= 0) {
    return NextResponse.json({ error: "roomTypeId and valid dates required" }, { status: 400 });
  }
  try {
    const available = await getAvailableUnits(roomTypeId, checkIn, checkOut);
    return NextResponse.json({ available });
  } catch {
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
  }
}
