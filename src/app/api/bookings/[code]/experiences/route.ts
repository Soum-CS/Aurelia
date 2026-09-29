import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadStayContext, createWalletTxn } from "@/lib/stay-api";
import { rateLimit } from "@/lib/rate-limit";
import { stayServiceKey } from "@/lib/stay";

export const dynamic = "force-dynamic";

/**
 * GET — nearby experience catalog for the booked hotel + what's already
 * added to this stay. Only properties with a curated catalog (seeded demo
 * data or a configured provider) return entries; others get an explicit
 * empty catalog, never invented attractions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const key = stayServiceKey(ctx.booking, ctx.hotel);
  const experiences = key
    ? await db.experience.findMany({ where: { hotelKey: key }, orderBy: { distanceKm: "asc" } })
    : [];
  const booked = await db.experienceBooking.findMany({
    where: { bookingId: ctx.booking.id },
    include: { experience: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    hotel: { name: ctx.hotel?.name ?? ctx.booking.hotelName ?? "Your hotel", city: ctx.hotel?.city ?? "" },
    experiences,
    myBookings: booked,
    curated: Boolean(key) && experiences.length > 0,
  });
}

/** POST — add an experience to the stay (server-priced, availability-checked). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const limiter = rateLimit(request, "experience-add", 20);
  if (!limiter.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const experienceId = String(body.experienceId ?? "");
  const exp = await db.experience.findUnique({ where: { id: experienceId } });
  const key = stayServiceKey(ctx.booking, ctx.hotel);
  if (!exp || !key || exp.hotelKey !== key) {
    return NextResponse.json(
      { error: "Experience not found near your hotel." },
      { status: 404 },
    );
  }
  if (!exp.available) {
    return NextResponse.json(
      { error: `${exp.name} is not accepting bookings right now.` },
      { status: 409 },
    );
  }

  const guests = Math.min(12, Math.max(1, Math.round(Number(body.guests ?? 2))));
  let when: Date | null = null;
  if (typeof body.when === "string" && body.when) {
    const d = new Date(body.when);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date/time." }, { status: 400 });
    }
    const start = new Date(ctx.booking.checkIn).getTime();
    const end = new Date(ctx.booking.checkOut).getTime() + 24 * 3600_000;
    if (d.getTime() < start - 24 * 3600_000 || d.getTime() > end) {
      return NextResponse.json(
        { error: "Pick a time within your stay window." },
        { status: 400 },
      );
    }
    when = d;
  }

  const priceInr = (exp.priceInr ?? 0) * guests;

  const created = await db.experienceBooking.create({
    data: {
      code: `EXP-${Math.floor(10000 + Math.random() * 90000)}`,
      bookingId: ctx.booking.id,
      experienceId: exp.id,
      userId: ctx.booking.userId,
      when,
      guests,
      priceInr,
    },
  });

  if (priceInr > 0) {
    const txn = await createWalletTxn({
      bookingId: ctx.booking.id,
      category: "ACTIVITIES",
      label: `${exp.name} · ${guests} guest${guests > 1 ? "s" : ""}`,
      amountInr: priceInr,
      source: "EXPERIENCE",
      sourceId: created.id,
    });
    created.priceInr = priceInr;
    await db.notification.create({
      data: {
        userId: ctx.booking.userId,
        bookingId: ctx.booking.id,
        type: "activity",
        title: `Added to your stay: ${exp.name}`,
        body: when
          ? `Planned for ${when.toLocaleString("en-IN")} · ${exp.meetingPoint ?? "see details"}.`
          : `Open the itinerary to pick a time.`,
        href: `/trips/${ctx.booking.code}/stay/experiences`,
        dedupeKey: `exp-${created.id}`,
      },
    });
    return NextResponse.json(
      { success: true, booking: created, walletRef: txn.ref },
      { status: 201 },
    );
  }

  return NextResponse.json({ success: true, booking: created }, { status: 201 });
}

/** DELETE ?bookingRef= — cancel an experience booking before it happens. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const row = await db.experienceBooking.findUnique({ where: { id } });
  if (!row || row.bookingId !== ctx.booking.id) {
    return NextResponse.json({ error: "Not found on this stay." }, { status: 404 });
  }
  if (row.status === "COMPLETED") {
    return NextResponse.json({ error: "Completed bookings cannot be cancelled." }, { status: 409 });
  }
  await db.experienceBooking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  // void any pending charge
  await db.walletTransaction.updateMany({
    where: { source: "EXPERIENCE", sourceId: id, status: "PENDING" },
    data: { status: "REFUNDED" },
  });
  return NextResponse.json({ success: true });
}
