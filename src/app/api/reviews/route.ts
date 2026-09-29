import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeSentiment } from "@/lib/sentiment";
import { ensureUser } from "@/lib/user";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = String(body.code ?? "");
  const text = String(body.text ?? "").slice(0, 4000).trim();
  const ratings = ["cleanliness", "staff", "comfort", "valueForMoney", "locationScore"].map(
    (k) => Number(body[k])
  );

  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  if (ratings.some((r) => !Number.isInteger(r) || r < 1 || r > 5)) {
    return NextResponse.json({ error: "All five categories need a 1–5 rating." }, { status: 400 });
  }
  if (text.length < 10) {
    return NextResponse.json({ error: "Tell us a little more (10+ characters)." }, { status: 400 });
  }

  const booking = await db.booking.findUnique({
    where: { code },
    include: { roomType: true, review: { select: { id: true } } },
  });
  if (!booking?.roomType) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.review) {
    return NextResponse.json({ error: "You've already reviewed this stay." }, { status: 409 });
  }

  const sentiment = analyzeSentiment(text);
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  // aggregate update
  const hotel = await db.hotel.findUnique({
    where: { id: booking.roomType.hotelId },
    select: { rating: true, reviewCount: true },
  });
  if (hotel) {
    const nextCount = hotel.reviewCount + 1;
    const nextRating =
      Math.round(((hotel.rating * hotel.reviewCount + avg) / nextCount) * 10) / 10;
    await db.hotel.update({
      where: { id: booking.roomType.hotelId },
      data: { rating: nextRating, reviewCount: nextCount },
    });
  }

  let setCookie: string | undefined;
  let userId: string | null = null;
  try {
    const ensured = await ensureUser();
    userId = ensured.userId;
    setCookie = ensured.setCookie;
  } catch {}

  const review = await db.review.create({
    data: {
      hotelId: booking.roomType.hotelId,
      bookingId: booking.id,
      authorName: booking.guestName,
      cleanliness: ratings[0],
      staff: ratings[1],
      comfort: ratings[2],
      valueForMoney: ratings[3],
      locationScore: ratings[4],
      text,
      sentimentScore: sentiment.score,
      flagged: sentiment.flagged,
    },
  });
  void userId;

  const res = NextResponse.json(
    {
      reviewId: review.id,
      sentiment,
      message: sentiment.flagged
        ? "Thank you — we're sorry this fell short. Your review has been flagged for immediate manager follow-up."
        : "Thank you — your review is live.",
    },
    { status: 201 }
  );
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}
