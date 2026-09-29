import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/stay-api";

export const dynamic = "force-dynamic";

const FOOD_FLOW = ["CONFIRMED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"] as const;

/**
 * PATCH /api/admin/orders/[id] — staff advances a food order's real status.
 * Transitions must follow the flow; DELIVERED is only reachable through the
 * flow (never jumped to), so the guest tracker can trust it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = String(body.status ?? "");
  const order = await db.foodOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (status === "CANCELLED") {
    if (order.status === "DELIVERED") {
      return NextResponse.json({ error: "Delivered orders cannot be cancelled." }, { status: 409 });
    }
    const updated = await db.foodOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        timeline: JSON.stringify({
          ...JSON.parse(order.timeline || "{}"),
          CANCELLED: new Date().toISOString(),
        }),
      },
    });
    await db.walletTransaction.updateMany({
      where: { source: "FOOD_ORDER", sourceId: id, status: "PENDING" },
      data: { status: "REFUNDED" },
    });
    return NextResponse.json({ success: true, order: updated });
  }

  const currentIdx = FOOD_FLOW.indexOf(order.status as (typeof FOOD_FLOW)[number]);
  const nextIdx = FOOD_FLOW.indexOf(status as (typeof FOOD_FLOW)[number]);
  if (nextIdx === -1) {
    return NextResponse.json({ error: `Unknown status "${status}".` }, { status: 400 });
  }
  if (currentIdx === -1) {
    return NextResponse.json(
      { error: `Order is ${order.status} and can no longer move.` },
      { status: 409 },
    );
  }
  if (nextIdx !== currentIdx + 1) {
    return NextResponse.json(
      { error: `Invalid transition ${order.status} → ${status}. Orders advance one step at a time.` },
      { status: 409 },
    );
  }

  const timeline = JSON.parse(order.timeline || "{}") as Record<string, string>;
  timeline[status] = new Date().toISOString();
  const etaMinutes =
    status === "PREPARING" ? Math.max(15, order.etaMinutes - 5) :
    status === "READY" ? 0 :
    status === "ON_THE_WAY" ? 5 : order.etaMinutes;

  const updated = await db.foodOrder.update({
    where: { id },
    data: { status, timeline: JSON.stringify(timeline), etaMinutes },
  });

  const booking = await db.booking.findUnique({
    where: { id: order.bookingId },
    select: { code: true },
  });
  if (booking) {
    await db.notification.create({
      data: {
        userId: order.userId,
        bookingId: order.bookingId,
        type: "food",
        title: `Order ${order.code} · ${status === "READY" ? "ready for delivery" : status === "ON_THE_WAY" ? "on the way" : status.toLowerCase()}`,
        body:
          status === "PREPARING"
            ? "The kitchen has started your order."
            : status === "READY"
              ? "Plating done — waiting for pickup."
              : status === "ON_THE_WAY"
                ? `Heading to ${order.deliveryLocation} now.`
                : `Delivered to ${order.deliveryLocation}. Enjoy!`,
        href: `/trips/${booking.code}/stay/food`,
        dedupeKey: `food-${id}-${status}`,
      },
    });
  }

  return NextResponse.json({ success: true, order: updated });
}
