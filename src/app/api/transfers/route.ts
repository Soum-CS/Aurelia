import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AIRPORTS, calculateTravelEstimate, VEHICLE_PRICING } from "@/lib/location/location-service";
import { getDatasetHotel } from "@/lib/hotels/csv-provider";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hotelId = String(body.hotelId ?? "");
  const airportCode = String(body.airportCode ?? "").toUpperCase();
  const type = (body.type === "DROP" ? "DROP" : "PICKUP") as "PICKUP" | "DROP";
  const vehicleType = (body.vehicleType ?? "SEDAN") as keyof typeof VEHICLE_PRICING;
  const passengers = Math.max(1, Number(body.passengers ?? 2));
  const flightNumber = String(body.flightNumber ?? "");
  const scheduledTimeStr = String(body.scheduledTime ?? "");
  const guestName = String(body.guestName ?? "").trim();
  const guestPhone = String(body.guestPhone ?? "").trim();
  const bookingId = body.bookingId ? String(body.bookingId) : undefined;

  if (!hotelId || !airportCode) {
    return NextResponse.json(
      { error: "hotelId and airportCode are required." },
      { status: 400 }
    );
  }

  const airport = AIRPORTS.find((a) => a.code === airportCode);
  if (!airport) {
    return NextResponse.json({ error: `Airport code ${airportCode} not supported.` }, { status: 404 });
  }

  // Resolve hotel coordinates from CSV dataset or database
  let hotelCoords = { latitude: 28.6139, longitude: 77.2090 };
  let resolvedHotelName = "Aurelia Luxury Partner Hotel";
  const csvHotel = await getDatasetHotel(hotelId).catch(() => null);
  if (csvHotel) {
    hotelCoords = { latitude: csvHotel.latitude, longitude: csvHotel.longitude };
    resolvedHotelName = csvHotel.name;
  } else {
    const dbHotel = await db.hotel.findFirst({
      where: { OR: [{ slug: hotelId }, { id: hotelId }, { name: hotelId }] },
    });
    if (dbHotel) {
      hotelCoords = { latitude: dbHotel.latitude, longitude: dbHotel.longitude };
      resolvedHotelName = dbHotel.name;
    }
  }

  const est = calculateTravelEstimate(
    hotelCoords,
    { latitude: airport.latitude, longitude: airport.longitude }
  );

  const vehicleInfo = VEHICLE_PRICING[vehicleType] ?? VEHICLE_PRICING.SEDAN;
  const priceInr = vehicleInfo.baseInr + Math.round(est.distanceKm * vehicleInfo.perKmInr);

  // Quote calculation mode
  if (!guestName || !guestPhone || body.quoteOnly === true) {
    return NextResponse.json({
      priceInr,
      distanceKm: est.distanceKm,
      formattedDistance: est.formattedDistance,
      travelTimeText: est.formattedDrivingTime,
      vehicleLabel: vehicleInfo.label,
      baseInr: vehicleInfo.baseInr,
    });
  }

  // Booking mode
  const code = `TRF-${Math.floor(10000 + Math.random() * 90000)}`;

  const transfer = await db.airportTransfer.create({
    data: {
      code,
      bookingId,
      hotelId,
      type,
      airportCode: airport.code,
      airportName: airport.name,
      flightNumber: flightNumber || null,
      scheduledTime: scheduledTimeStr ? new Date(scheduledTimeStr) : new Date(Date.now() + 86400000),
      passengers,
      vehicleType,
      priceInr,
      status: "CONFIRMED",
      paymentStatus: "CONFIRMED",
      guestName,
      guestPhone,
    },
  });

  return NextResponse.json({
    success: true,
    code: transfer.code,
    status: transfer.status,
    priceInr: transfer.priceInr,
    vehicleLabel: vehicleInfo.label,
    travelTimeText: est.formattedDrivingTime,
    scheduledTime: transfer.scheduledTime,
    transfer: {
      id: transfer.id,
      code: transfer.code,
      type: transfer.type,
      airportName: transfer.airportName,
      airportCode: transfer.airportCode,
      hotelName: resolvedHotelName,
      distanceKm: est.distanceKm,
      drivingTimeMinutes: est.drivingMinutes,
      formattedTravelTime: est.formattedDrivingTime,
      vehicleLabel: vehicleInfo.label,
      passengers: transfer.passengers,
      priceInr: transfer.priceInr,
      scheduledTime: transfer.scheduledTime,
      status: transfer.status,
    },
  });
}
