import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conciergeAnswer, type FaqItem } from "@/lib/concierge";
import { getUserToken, findUserByToken } from "@/lib/user";
import { parseStringArray } from "@/lib/data";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = String(body.message ?? "").slice(0, 1000).trim();
  const code = typeof body.code === "string" ? body.code : null;
  if (!message) return NextResponse.json({ error: "Say something first :)" }, { status: 400 });

  let faq: FaqItem[] = [];
  let hotelName = "the hotel";
  let hotelSlug = "";
  let guestName: string | undefined;
  let bookingId: string | null = null;
  let userId: string | null = null;

  if (code) {
    const booking = await db.booking.findUnique({
      where: { code },
      include: { roomType: { include: { hotel: true } } },
    });
    if (booking) {
      bookingId = booking.id;
      userId = booking.userId;
      guestName = booking.guestName;
      hotelName = booking.roomType?.hotel.name ?? booking.hotelName ?? "the hotel";
      hotelSlug = booking.roomType?.hotel.slug ?? "";
      faq = JSON.parse(booking.roomType?.hotel.faq ?? "[]");
    }
  }

  if (!userId) {
    const token = await getUserToken();
    const user = await findUserByToken(token);
    if (user) userId = user.id;
  }

  const prefRow = userId
    ? await db.userPreference.findUnique({ where: { userId } })
    : null;
  const preferences = prefRow
    ? {
        foodPrefs: parseStringArray(prefRow.foodPrefs),
        cuisines: parseStringArray(prefRow.cuisines),
        roomPrefs: parseStringArray(prefRow.roomPrefs),
        interests: parseStringArray(prefRow.interests),
        allergies: parseStringArray(prefRow.allergies),
        bedPreference: prefRow.bedPreference,
        temperatureC: prefRow.temperatureC,
        budgetPerNightInr: prefRow.budgetPerNightInr,
        checkinTime: prefRow.checkinTime,
        checkoutTime: prefRow.checkoutTime,
      }
    : null;

  const result = conciergeAnswer(message, { hotelName, hotelSlug, guestName, faq, preferences });

  let ticketId: string | null = null;
  if (result.escalate && bookingId) {
    const ticket = await db.serviceRequest.create({
      data: {
        bookingId,
        kind: "CONCIERGE_TICKET",
        title: "Human handoff requested",
        detail: message.slice(0, 500),
        priority: "URGENT",
      },
    });
    ticketId = ticket.id;
  }

  return NextResponse.json({
    reply: result.reply,
    escalate: result.escalate,
    matchedIntent: result.matchedIntent,
    suggestions: result.suggestions,
    ticketId,
  });
}
