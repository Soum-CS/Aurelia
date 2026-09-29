import { NextResponse } from "next/server";
import { getRoomTypeById } from "@/lib/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = await getRoomTypeById(id);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    roomType: { ...room, hotel: { id: room.hotel.id, slug: room.hotel.slug, name: room.hotel.name, city: room.hotel.city, country: room.hotel.country } },
  });
}
