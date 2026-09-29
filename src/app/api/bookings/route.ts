import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nightsBetween } from "@/lib/format";
import { quotePrice } from "@/lib/pricing";
import { getUsdToInrRate, toINR } from "@/lib/currency";
import { getProvider, providerStatus, providerMode } from "@/lib/hotel-provider";
import { ensureUser } from "@/lib/user";
import { getBookingByCode } from "@/lib/data";

function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `AUR-${out.slice(0, 4)}-${out.slice(4)}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Dataset mode (HOTEL_PROVIDER=csv): validate against the CSV inventory.
  if (providerMode() === "csv") {
    return bookFromDataset(b);
  }
  // Real bookings only: refuse to create records against non-existent inventory.
  if (!getProvider()) {
    return NextResponse.json(
      {
        error: "LIVE_CONNECTION_REQUIRED",
        message: "Live hotel data connection required.",
        requires: providerStatus().requires,
      },
      { status: 503 }
    );
  }
  const roomTypeId = typeof b.roomTypeId === "string" ? b.roomTypeId : "";
  const checkIn = typeof b.checkIn === "string" ? b.checkIn : "";
  const checkOut = typeof b.checkOut === "string" ? b.checkOut : "";
  const guests = Number(b.guests);
  const addonIds = Array.isArray(b.addons) ? b.addons.filter((a): a is string => typeof a === "string") : [];
  const guestName = typeof b.guestName === "string" ? b.guestName.trim() : "";
  const guestEmail = typeof b.guestEmail === "string" ? b.guestEmail.trim() : "";
  const card = (b.payment ?? {}) as Record<string, unknown>;

  // --- validation ---
  if (!guestName || guestName.length < 2) {
    return NextResponse.json({ error: "Please provide the guest name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > 30) {
    return NextResponse.json({ error: "Stay must be between 1 and 30 nights." }, { status: 400 });
  }
  const todayISO = new Date().toISOString().slice(0, 10);
  if (checkIn < todayISO) {
    return NextResponse.json({ error: "Check-in cannot be in the past." }, { status: 400 });
  }

  // --- mock payment validation (no real charge, nothing stored) ---
  const digits = String(card.cardNumber ?? "").replace(/\s+/g, "");
  if (!/^\d{15,16}$/.test(digits)) {
    return NextResponse.json({ error: "Card number looks invalid." }, { status: 400 });
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(card.expiry ?? ""))) {
    return NextResponse.json({ error: "Expiry must be in MM/YY format." }, { status: 400 });
  }
  const [mm, yy] = String(card.expiry).split("/").map(Number);
  const now = new Date();
  if (2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1)) {
    return NextResponse.json({ error: "Card has expired." }, { status: 400 });
  }
  if (!/^\d{3,4}$/.test(String(card.cvc ?? ""))) {
    return NextResponse.json({ error: "CVC looks invalid." }, { status: 400 });
  }

  // --- booking creation with re-check to prevent double-booking ---
  try {
    const { userId, setCookie } = await ensureUser();

    const created = await db.$transaction(async (tx) => {
      const room = await tx.roomType.findUnique({ where: { id: roomTypeId } });
      if (!room) throw new Error("ROOM_NOT_FOUND");
      if (!Number.isInteger(guests) || guests < 1 || guests > room.capacity) {
        throw new Error("GUESTS_INVALID");
      }

      const overlapping = await tx.booking.count({
        where: {
          roomTypeId,
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          checkIn: { lt: new Date(checkOut) },
          checkOut: { gt: new Date(checkIn) },
        },
      });
      if (overlapping >= room.unitsAvailable) {
        throw new Error("SOLD_OUT");
      }

      const quote = quotePrice(room.basePrice, nights, guests, addonIds);
      const rateInfo = await getUsdToInrRate();
      const totalInr = toINR(quote.total, rateInfo).convertedAmount;

      return tx.booking.create({
        data: {
          code: generateCode(),
          roomTypeId,
          userId,
          guestName,
          guestEmail,
          checkIn: new Date(`${checkIn}T14:00:00.000Z`),
          checkOut: new Date(`${checkOut}T11:00:00.000Z`),
          nights,
          guests,
          addons: JSON.stringify(quote.addons),
          subtotal: quote.roomsSubtotal + quote.addonsTotal + quote.serviceFee,
          taxesFees: quote.taxesFees,
          total: quote.total,
          // INR snapshot at booking time — confirmation & trips show this
          currency: "USD",
          totalInr,
          inrRateUsed: rateInfo.rate,
          provider: "amadeus",
          destinationLabel: typeof b.place === "string" ? b.place.slice(0, 140) : null,
          status: "CONFIRMED",
        },
      });
    });

    const res = NextResponse.json(
      { code: created.code, total: created.total, totalInr: created.totalInr },
      { status: 201 }
    );
    if (setCookie) res.headers.append("Set-Cookie", setCookie);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ROOM_NOT_FOUND") {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    if (msg === "GUESTS_INVALID") {
      return NextResponse.json({ error: "Too many guests for this room." }, { status: 400 });
    }
    if (msg === "LIVE_CONNECTION_REQUIRED") {
      return NextResponse.json(
        {
          error: "LIVE_CONNECTION_REQUIRED",
          message: "Live hotel data connection required.",
          requires: providerStatus().requires,
        },
        { status: 503 }
      );
    }
    if (msg === "SOLD_OUT") {
      return NextResponse.json(
        { error: "Those dates just sold out. Please pick different dates." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not complete booking." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const booking = await getBookingByCode(code);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hotel = booking.roomType?.hotel;
  return NextResponse.json({
    ...booking,
    roomType: booking.roomType ? { ...booking.roomType, hotel: undefined } : null,
    hotel: hotel ?? null,
  });
}


/* ---------- dataset (HOTEL_PROVIDER=csv) bookings ---------- */

async function bookFromDataset(b: Record<string, unknown>) {
  const { getDatasetHotel } = await import("@/lib/hotels/csv-provider");
  const { isAvailableForStay } = await import("@/lib/hotels/csv-loader");

  const hotelId = typeof b.hotelId === "string" ? b.hotelId : "";
  const checkIn = typeof b.checkIn === "string" ? b.checkIn : "";
  const checkOut = typeof b.checkOut === "string" ? b.checkOut : "";
  const roomsRequested = Math.round(Number(b.rooms ?? 1));
  const guestName = typeof b.guestName === "string" ? b.guestName.trim() : "";
  const guestEmail = typeof b.guestEmail === "string" ? b.guestEmail.trim() : "";

  if (!guestName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: "Please provide a valid guest name and email." }, { status: 400 });
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  }

  const hotel = await getDatasetHotel(hotelId);
  if (!hotel) {
    return NextResponse.json({ error: "Hotel not found in the configured dataset." }, { status: 404 });
  }
  if (!isAvailableForStay(hotel, checkIn, checkOut, roomsRequested)) {
    if (roomsRequested > hotel.rooms_available) {
      return NextResponse.json(
        { error: `Only ${hotel.rooms_available} ${hotel.rooms_available === 1 ? "room is" : "rooms are"} currently available.` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: `This stay is outside the hotel's availability window (${hotel.available_from} → ${hotel.available_to}).` },
      { status: 409 }
    );
  }

  // §8: price_per_night_inr × nights × rooms — nothing invented.
  const total = hotel.price_per_night_inr * nights * roomsRequested;

  const { userId, setCookie } = await ensureUser();
  const created = await db.booking.create({
    data: {
      code: generateCode(),
      roomTypeId: null,
      userId,
      guestName,
      guestEmail,
      checkIn: new Date(`${checkIn}T14:00:00.000Z`),
      checkOut: new Date(`${checkOut}T11:00:00.000Z`),
      nights,
      guests: Number(b.guests ?? 1) || 1,
      addons: JSON.stringify([]),
      subtotal: total,
      taxesFees: 0,
      total,
      currency: "INR",
      totalInr: total,
      provider: "csv-dataset",
      providerBookingId: hotelId,
      destinationLabel: `${hotel.city}, ${hotel.state}`,
      hotelName: hotel.name,
      roomName: hotel.room_type,
      status: "CONFIRMED",
    },
  });

  const res = NextResponse.json(
    {
      code: created.code,
      source: "csv",
      summary: {
        hotel: hotel.name,
        roomType: hotel.room_type,
        checkIn,
        checkOut,
        nights,
        rooms: roomsRequested,
        pricePerNightInr: hotel.price_per_night_inr,
        totalInr: total,
      },
    },
    { status: 201 }
  );
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}
