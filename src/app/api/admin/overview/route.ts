import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/stay-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview — staff dashboard. Requires ADMIN_TOKEN.
 * Reads only real operational data; no fabricated metrics.
 */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      {
        error: "ADMIN_NOT_CONFIGURED",
        message: "Set ADMIN_TOKEN in .env.local and sign in with it to view hotel operations.",
      },
      { status: process.env.ADMIN_TOKEN ? 401 : 503 },
    );
  }

  const now = new Date();
  const [bookings, orders, requests, roomTypes] = await Promise.all([
    db.booking.findMany({
      where: { status: { notIn: ["PENDING_PAYMENT", "PAYMENT_FAILED"] } },
      include: { roomType: { include: { hotel: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.foodOrder.findMany({
      include: { items: true, booking: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.serviceRequest.findMany({
      include: { booking: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.roomType.findMany({ include: { hotel: true, _count: { select: { bookings: true } } } }),
  ]);

  const activeGuests = bookings.filter(
    (b) => b.status === "CHECKED_IN" || (b.status === "CONFIRMED" && new Date(b.checkIn) <= now && new Date(b.checkOut) >= now),
  ).length;
  const occupiedRooms = bookings.filter((b) => b.status === "CHECKED_IN").length;

  const foodRevenue = orders.reduce((s, o) => s + o.totalInr, 0);
  const dishCounts = new Map<string, number>();
  for (const o of orders) {
    for (const it of o.items) {
      dishCounts.set(it.name, (dishCounts.get(it.name) ?? 0) + it.qty);
    }
  }
  const popularDishes = [...dishCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, qty]) => ({ name, qty }));

  return NextResponse.json({
    overview: {
      bookings: bookings.length,
      activeGuests,
      occupiedRooms,
      revenueRoomInrApprox: bookings
        .filter((b) => b.paymentStatus === "PAID")
        .reduce((s, b) => s + Math.round(b.totalInr ?? 0), 0),
      foodOrders: orders.length,
      pendingServiceRequests: requests.filter((r) => r.status === "OPEN").length,
    },
    food: {
      confirmed: orders.filter((o) => o.status === "CONFIRMED").length,
      preparing: orders.filter((o) => o.status === "PREPARING").length,
      ready: orders.filter((o) => o.status === "READY").length,
      onTheWay: orders.filter((o) => o.status === "ON_THE_WAY").length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
      revenueInr: foodRevenue,
      popularDishes,
      recent: orders.slice(0, 12).map((o) => ({
        id: o.id,
        code: o.code, status: o.status, totalInr: o.totalInr,
        deliveryLocation: o.deliveryLocation,
        placedAt: o.createdAt,
        guest: o.booking.guestName,
        items: o.items.map((i) => `${i.qty}× ${i.name}`),
      })),
    },
    services: {
      open: requests.filter((r) => r.status === "OPEN").map((r) => ({ id: r.id, title: r.title, detail: r.detail, priority: r.priority, kind: r.kind, guest: r.booking.guestName, code: r.booking.code, createdAt: r.createdAt })),
      accepted: requests.filter((r) => r.status === "ACCEPTED").map((r) => ({ id: r.id, title: r.title, guest: r.booking.guestName, code: r.booking.code })),
      inProgress: requests.filter((r) => r.status === "IN_PROGRESS").map((r) => ({ id: r.id, title: r.title, guest: r.booking.guestName, code: r.booking.code })),
      resolvedToday: requests.filter((r) => r.status === "RESOLVED").length,
    },
    rooms: {
      totalUnits: roomTypes.reduce((s, r) => s + r.unitsAvailable, 0),
      occupied: occupiedRooms,
      byType: roomTypes.map((r) => ({
        name: r.name,
        hotel: r.hotel.name,
        unitsAvailable: r.unitsAvailable,
        bookedAllTime: r._count.bookings,
      })),
    },
    recentBookings: bookings.slice(0, 12).map((b) => ({
      code: b.code,
      guest: b.guestName,
      hotel: b.hotelName ?? b.roomType?.hotel.name,
      room: b.roomName ?? b.roomType?.name,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      paymentStatus: b.paymentStatus,
      totalInr: b.totalInr,
    })),
  });
}
