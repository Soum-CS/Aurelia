import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {}

  const allowed = ["arrivalTime", "flightNumber", "specialRequests", "pillow", "minibar"];
  const update: Record<string, string> = {};
  for (const key of allowed) {
    const v = body[key];
    if (typeof v === "string" && v.length <= 500) update[key] = v;
  }

  const booking = await db.booking.findUnique({ where: { code } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "This booking is already checked in." },
      { status: 409 }
    );
  }

  const merged = JSON.stringify({
    ...JSON.parse(booking.preArrival ?? "{}"),
    ...update,
    savedAt: new Date().toISOString(),
  });

  await db.booking.update({ where: { code }, data: { preArrival: merged } });
  return NextResponse.json({ saved: true });
}
