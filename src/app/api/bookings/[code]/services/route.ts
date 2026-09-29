import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROOM_SERVICE_MENU } from "@/lib/constants";
import { createWalletTxn } from "@/lib/stay-api";
import { ensureRoomWalletTxn } from "@/lib/stay";

const KINDS = ["ROOM_SERVICE", "HOUSEKEEPING", "SPA", "RESTAURANT", "ISSUE", "CONCIERGE_TICKET"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code },
    include: { serviceRequests: { orderBy: { createdAt: "desc" } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ requests: booking.serviceRequests });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({ where: { code } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!["CONFIRMED", "CHECKED_IN"].includes(booking.status)) {
    return NextResponse.json({ error: "This stay is not active." }, { status: 409 });
  }

  const kind = String(body.kind ?? "");
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown request type." }, { status: 400 });
  }

  let title = typeof body.title === "string" ? body.title.slice(0, 140) : "";
  let price = 0;
  const detail = typeof body.detail === "string" ? body.detail.slice(0, 1000) : null;

  if (kind === "ROOM_SERVICE") {
    const itemId = String(body.itemId ?? "");
    const item = ROOM_SERVICE_MENU.find((m) => m.id === itemId);
    if (!item) return NextResponse.json({ error: "Unknown menu item." }, { status: 400 });
    title = item.name;
    price = item.price;
  }

  if (kind === "ISSUE") {
    const severity = String(body.severity ?? "minor");
    const priority = severity === "major" ? "URGENT" : "NORMAL";
    const photoUrl =
      typeof body.photoUrl === "string" && body.photoUrl.startsWith("data:image/") && body.photoUrl.length < 900_000
        ? body.photoUrl
        : null;

    const created = await db.serviceRequest.create({
      data: {
        bookingId: booking.id,
        kind,
        title: title || "Issue reported",
        detail,
        priority,
        photoUrl,
      },
    });
    return NextResponse.json(
      {
        request: created,
        routing: priority === "URGENT"
          ? "Escalated to the duty engineer — ETA under 30 minutes."
          : "Logged with housekeeping — typically resolved within a few hours.",
      },
      { status: 201 }
    );
  }

  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const created = await db.serviceRequest.create({
    data: {
      bookingId: booking.id,
      kind,
      title,
      detail,
      price,
      priority: body.priority === "URGENT" ? "URGENT" : "NORMAL",
    },
  });

  // priced services flow into the Aurelia Wallet + unified bill
  if (price > 0) {
    await ensureRoomWalletTxn(booking);
    const { getUsdToInrRate } = await import("@/lib/currency");
    const rateInfo = booking.currency === "USD" ? await getUsdToInrRate() : null;
    await createWalletTxn({
      bookingId: booking.id,
      category:
        kind === "SPA" ? "SPA"
        : kind === "ROOM_SERVICE" ? "FOOD"
        : kind === "RESTAURANT" ? "FOOD"
        : /laundry|dry.?clean/i.test(`${title} ${detail ?? ""}`)
          ? "LAUNDRY"
          : "SERVICES",
      label: title,
      amountInr: Math.round(price * (rateInfo?.rate ?? 1)),
      taxInr: 0,
      source: "SERVICE_REQUEST",
      sourceId: created.id,
    });
  }

  await db.notification.create({
    data: {
      userId: booking.userId,
      bookingId: booking.id,
      type: "service",
      title: `Request logged · ${title}`,
      body: "The team has it — track progress under Services.",
      href: `/trips/${code}/stay/services`,
      dedupeKey: `svc-created-${created.id}`,
    },
  });

  return NextResponse.json({ request: created }, { status: 201 });
}
