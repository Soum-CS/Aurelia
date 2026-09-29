import { NextRequest, NextResponse } from "next/server";
import { ensureUser, findUserByToken, getUserToken } from "@/lib/user";
import { db } from "@/lib/db";
import { listWishlist } from "@/lib/data";

export async function GET() {
  const token = await getUserToken();
  const user = await findUserByToken(token);
  if (!user) return NextResponse.json({ items: [] });
  const items = await listWishlist(user.id);
  return NextResponse.json({
    items: items.map((i) => ({
      hotelId: i.hotel.id,
      slug: i.hotel.slug,
      priceAtSave: i.priceAtSave,
      priceNow: i.hotel.priceFrom,
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const hotelId = (body as { hotelId?: string }).hotelId;
  if (!hotelId || typeof hotelId !== "string") {
    return NextResponse.json({ error: "hotelId required" }, { status: 400 });
  }

  const hotel = await db.hotel.findUnique({
    where: { id: hotelId },
    include: { roomTypes: { select: { basePrice: true } } },
  });
  if (!hotel) return NextResponse.json({ error: "Hotel not found" }, { status: 404 });

  const { userId, setCookie } = await ensureUser();

  const existing = await db.wishlist.findUnique({
    where: { userId_hotelId: { userId, hotelId } },
  });

  if (existing) {
    await db.wishlist.delete({ where: { id: existing.id } });
    const res = NextResponse.json({ saved: false });
    if (setCookie) res.headers.append("Set-Cookie", setCookie);
    return res;
  }

  await db.wishlist.create({
    data: {
      userId,
      hotelId,
      priceAtSave: Math.min(...hotel.roomTypes.map((r) => r.basePrice), Infinity),
    },
  });
  const res = NextResponse.json({ saved: true });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}
