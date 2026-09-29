import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadStayContext, createWalletTxn } from "@/lib/stay-api";
import { rateLimit } from "@/lib/rate-limit";
import { FOOD_TAX_RATE, parseMenuAddons, ensureRestaurantForStay } from "@/lib/stay";

export const dynamic = "force-dynamic";

function orderCode(): string {
  return `AUR-${Math.floor(10000 + Math.random() * 90000)}`;
}

/**
 * GET /api/bookings/[code]/food/orders — this stay's orders + live status.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const orders = await db.foodOrder.findMany({
    where: { bookingId: ctx.booking.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      timeline: JSON.parse(o.timeline || "{}"),
      items: o.items.map((it) => ({
        ...it,
        addons: JSON.parse(it.addons || "[]"),
      })),
    })),
  });
}

/**
 * POST /api/bookings/[code]/food/orders
 * Body: { items: [{ menuItemId, qty, addonNames?: string[] }],
 *         scheduledFor?: ISO, deliveryLocation?, notes? }
 *
 * Prices are ALWAYS re-derived server-side from the menu; the browser never
 * dictates an amount. Availability is enforced (unavailable items are
 * rejected). Nothing here marks an order delivered — only staff transitions do.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const limiter = rateLimit(request, "food-order", 15);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
    );
  }

  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  if (rawItems.length > 30) {
    return NextResponse.json({ error: "Too many lines in one order." }, { status: 400 });
  }

  const restaurant = await ensureRestaurantForStay(ctx.booking, ctx.hotel);
  if (!restaurant) {
    return NextResponse.json(
      { error: "RESTAURANT_NOT_CONFIGURED", message: `Dining at ${ctx.booking.hotelName ?? "your hotel"} is not available through Aurelia yet. No order was placed.` },
      { status: 503 },
    );
  }

  // validate every line against real menu rows
  type Line = {
    menuItemId: string;
    name: string;
    unitPriceInr: number;
    qty: number;
    addons: { name: string; priceInr: number }[];
    lineTotalInr: number;
  };
  const lines: Line[] = [];
  for (const raw of rawItems) {
    const entry = raw as Record<string, unknown>;
    const menuItemId = String(entry.menuItemId ?? "");
    const qty = Math.min(20, Math.max(1, Math.round(Number(entry.qty ?? 1))));
    const item = await db.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item || item.restaurantId !== restaurant.id) {
      return NextResponse.json(
        { error: `Menu item not found at ${restaurant.name}.` },
        { status: 400 },
      );
    }
    if (!item.available) {
      return NextResponse.json(
        { error: `${item.name} is sold out right now. Please remove it and try again.` },
        { status: 409 },
      );
    }
    const allowed = parseMenuAddons(item.addons);
    const requestedAddons = Array.isArray(entry.addonNames)
      ? (entry.addonNames as unknown[]).map(String)
      : [];
    const addons = allowed.filter((a) => requestedAddons.includes(a.name));
    const unitPriceInr = item.priceInr + addons.reduce((s, a) => s + a.priceInr, 0);
    lines.push({
      menuItemId: item.id,
      name: item.name,
      unitPriceInr,
      qty,
      addons,
      lineTotalInr: unitPriceInr * qty,
    });
  }

  const subtotalInr = lines.reduce((s, l) => s + l.lineTotalInr, 0);
  const serviceChargeInr = 0;
  const taxInr = Math.round(subtotalInr * FOOD_TAX_RATE);
  const totalInr = subtotalInr + serviceChargeInr + taxInr;

  let scheduledFor: Date | null = null;
  if (typeof body.scheduledFor === "string" && body.scheduledFor) {
    const d = new Date(body.scheduledFor);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
    }
    if (d.getTime() < Date.now()) {
      return NextResponse.json({ error: "Scheduled time must be in the future." }, { status: 400 });
    }
    const stayEnd = new Date(ctx.booking.checkOut).getTime();
    if (d.getTime() > stayEnd) {
      return NextResponse.json(
        { error: "Scheduled time is after your checkout." },
        { status: 400 },
      );
    }
    scheduledFor = d;
  }

  const deliveryLocation =
    typeof body.deliveryLocation === "string" && body.deliveryLocation.trim()
      ? body.deliveryLocation.trim().slice(0, 120)
      : ctx.booking.roomNumber
        ? `Room ${ctx.booking.roomNumber}`
        : "Room service";

  const maxEta = Math.max(...lines.map(() => 25)) + 5; // kitchen baseline

  let created = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await db.foodOrder.create({
        data: {
          code: orderCode(),
          bookingId: ctx.booking.id,
          userId: ctx.booking.userId,
          hotelId: restaurant.hotelKey,
          status: "CONFIRMED",
          scheduledFor,
          deliveryLocation,
          notes:
            typeof body.notes === "string" ? body.notes.slice(0, 500) : null,
          subtotalInr,
          taxInr,
          serviceChargeInr,
          totalInr,
          etaMinutes: maxEta,
          timeline: JSON.stringify({ CONFIRMED: new Date().toISOString() }),
          items: {
            create: lines.map((l) => ({
              menuItemId: l.menuItemId,
              name: l.name,
              unitPriceInr: l.unitPriceInr,
              qty: l.qty,
              addons: JSON.stringify(l.addons),
              lineTotalInr: l.lineTotalInr,
            })),
          },
        },
      });
    } catch {
      /* code collision — retry with a new code */
    }
  }
  if (!created) {
    return NextResponse.json(
      { error: "Could not create the order. No order was placed — please retry." },
      { status: 500 },
    );
  }

  const txn = await createWalletTxn({
    bookingId: ctx.booking.id,
    category: "FOOD",
    label: `${restaurant.name} · ${lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}`,
    amountInr: totalInr,
    taxInr,
    source: "FOOD_ORDER",
    sourceId: created.id,
  });
  await db.foodOrder.update({
    where: { id: created.id },
    data: { walletTxnId: txn.ref },
  });

  await db.notification.create({
    data: {
      userId: ctx.booking.userId,
      bookingId: ctx.booking.id,
      type: "food",
      title: `Order ${created.code} confirmed`,
      body: scheduledFor
        ? `Scheduled for ${scheduledFor.toLocaleString("en-IN")} · ${deliveryLocation}.`
        : `The kitchen has it · ETA ~${maxEta} min · ${deliveryLocation}.`,
      href: `/trips/${ctx.booking.code}/stay/food`,
      dedupeKey: `food-order-${created.id}`,
    },
  });

  return NextResponse.json(
    {
      success: true,
      order: {
        ...created,
        timeline: JSON.parse(created.timeline),
        walletRef: txn.ref,
      },
    },
    { status: 201 },
  );
}
