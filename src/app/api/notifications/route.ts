import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserToken, findUserByToken } from "@/lib/user";
import { deriveStayStage } from "@/lib/stay";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications — proactive notifications derived ONLY from real
 * booking/order/service/experience data. Candidates are upserted by a stable
 * dedupeKey so reminders appear once and read-state persists.
 */
export async function GET() {
  const token = await getUserToken();
  const user = await findUserByToken(token);
  if (!user) return NextResponse.json({ notifications: [] });

  const bookings = await db.booking.findMany({
    where: { userId: user.id },
    include: {
      roomType: { include: { hotel: true } },
      serviceRequests: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const now = Date.now();
  type Candidate = {
    dedupeKey: string;
    type: string;
    title: string;
    body: string;
    href?: string | null;
    at?: Date;
  };
  const candidates: Candidate[] = [];

  for (const b of bookings) {
    if (b.status === "PENDING_PAYMENT" || b.status === "PAYMENT_FAILED") continue;
    const stage = deriveStayStage(b);
    const ciMs = new Date(b.checkIn).getTime();
    const coMs = new Date(b.checkOut).getTime();

    if (["BOOKED", "PRE_ARRIVAL"].includes(stage)) {
      const daysToCi = Math.round((ciMs - now) / 86_400_000);
      if (daysToCi === 1) {
        candidates.push({ dedupeKey: `ci-1d-${b.id}`, type: "checkin", title: "Your check-in is tomorrow", body: `${b.hotelName ?? b.roomType?.hotel.name ?? "Your hotel"} · ${b.roomName ?? ""}. Pre-arrival details are ready.`, href: `/trips/${b.code}` });
      } else if (daysToCi <= 0 && now < ciMs + 6 * 3600_000) {
        candidates.push({ dedupeKey: `ci-today-${b.id}`, type: "checkin", title: "Check-in day", body: `Rooms are ready from 2 PM — digital check-in takes a minute.`, href: `/trips/${b.code}/check-in` });
      }
    }

    if (stage === "CHECKOUT") {
      candidates.push({ dedupeKey: `co-soon-${b.id}`, type: "checkout", title: `Checkout tomorrow at ${new Date(coMs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`, body: "Settle your unified bill from the wallet whenever you're ready.", href: `/trips/${b.code}/stay/wallet` });
    }
    if (stage === "IN_STAY") {
      const daysToCo = Math.round((coMs - now) / 86_400_000);
      if (daysToCo === 1) {
        candidates.push({ dedupeKey: `co-1d-${b.id}`, type: "checkout", title: "Checkout is tomorrow at 11 AM", body: "Review pending charges in your wallet first.", href: `/trips/${b.code}/stay/wallet` });
      }
      for (const r of b.serviceRequests.filter((s) => ["ACCEPTED", "IN_PROGRESS"].includes(s.status))) {
        candidates.push({ dedupeKey: `svc-${r.id}-${r.status}`, type: "service", title: `${r.title} · ${r.status === "ACCEPTED" ? "accepted" : "in progress"}`, body: r.detail ?? "The team is on it.", href: `/trips/${b.code}/stay/services`, at: r.createdAt });
      }
    }

    const orders = await db.foodOrder.findMany({
      where: { bookingId: b.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    for (const o of orders) {
      if (o.scheduledFor && o.status === "CONFIRMED") {
        const t = new Date(o.scheduledFor).getTime();
        if (t - now < 3600_000 && t > now) {
          candidates.push({ dedupeKey: `food-sched-${o.id}-${Math.floor(t / 3600_000)}`, type: "food", title: `Scheduled order ${o.code} soon`, body: `Arriving around ${new Date(o.scheduledFor).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · ${o.deliveryLocation}`, href: `/trips/${b.code}/stay/food` });
        }
      }
    }

    const expBookings = await db.experienceBooking.findMany({
      where: { bookingId: b.id, status: "BOOKED", when: { not: null } },
      include: { experience: true },
      take: 5,
    });
    for (const eb of expBookings) {
      const t = new Date(eb.when!).getTime();
      if (t - now < 30 * 60_000 && t > now) {
        candidates.push({ dedupeKey: `exp-soon-${eb.id}`, type: "activity", title: `${eb.experience.name} starts in 30 minutes`, body: eb.experience.meetingPoint ?? `${eb.experience.distanceKm.toFixed(1)} km away`, href: `/trips/${b.code}/stay/experiences` });
      } else if (t - now < 26 * 3600_000 && t > now) {
        candidates.push({ dedupeKey: `exp-tmrw-${eb.id}`, type: "activity", title: `Tomorrow: ${eb.experience.name}`, body: new Date(eb.when!).toLocaleString("en-IN"), href: `/trips/${b.code}/stay/experiences` });
      }
    }
  }

  for (const c of candidates) {
    await db.notification.upsert({
      where: { dedupeKey: c.dedupeKey },
      update: {}, // keep original createdAt + readAt
      create: {
        userId: user.id,
        type: c.type,
        title: c.title,
        body: c.body,
        href: c.href ?? null,
        dedupeKey: c.dedupeKey,
      },
    });
  }

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }],
    take: 25,
  });

  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.readAt).length,
  });
}

/** PATCH — mark notifications read: { ids: string[] } or { all: true }. */
export async function PATCH(request: NextRequest) {
  const token = await getUserToken();
  const user = await findUserByToken(token);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { ids?: string[]; all?: boolean };
  try {
    body = (await request.json()) as { ids?: string[]; all?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = { readAt: new Date() };
  if (body.all) {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data,
    });
  } else if (Array.isArray(body.ids) && body.ids.length) {
    await db.notification.updateMany({
      where: { id: { in: body.ids.slice(0, 50) }, userId: user.id },
      data,
    });
  } else {
    return NextResponse.json({ error: "Provide ids or all." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
