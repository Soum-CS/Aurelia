import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadStayContext } from "@/lib/stay-api";
import { rateLimit } from "@/lib/rate-limit";
import { stayServiceKey } from "@/lib/stay";
import { getUserToken, findUserByToken } from "@/lib/user";

export const dynamic = "force-dynamic";

interface ItinItem {
  time: string;
  emoji: string;
  title: string;
  detail?: string;
}
interface StayDay {
  date: string;
  label: string;
  items: ItinItem[];
}

const INTEREST_TO_CATEGORIES: Record<string, string[]> = {
  culture: ["museums", "attractions"],
  history: ["museums", "attractions"],
  art: ["museums"],
  food: ["restaurants"],
  nature: ["activities", "tours"],
  adventure: ["activities", "tours"],
  nightlife: ["events"],
  music: ["events"],
  relaxation: ["activities"],
  shopping: ["shopping"],
};

function fmt(date: Date): string {
  return date.toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" });
}

/**
 * POST — generate (or regenerate) MY AI ITINERARY from real inputs only:
 * the stay dates, the booked hotel's location tips and its actual experience
 * catalog, dining hours, plus the guest's saved preferences when present.
 * Regeneration re-shuffles picks; nothing is invented about places we
 * don't have data for.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const limiter = rateLimit(request, "itinerary", 12);
  if (!limiter.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const ctx = await loadStayContext(decodeURIComponent(code));
  if (!ctx.ok) return ctx.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* body optional */
  }
  const interests = Array.isArray(body.interests) ? (body.interests as unknown[]).map(String) : [];
  const budgetInr = Number(body.budgetInr ?? 0) || null;

  const userToken = await getUserToken();
  const sessionUser = await findUserByToken(userToken);
  const targetUserId = ctx.booking.userId || sessionUser?.id;
  const prefs = targetUserId
    ? await db.userPreference.findUnique({ where: { userId: targetUserId } })
    : null;
  const prefInterests = prefs ? (JSON.parse(prefs.interests || "[]") as string[]) : [];
  const allInterests = [...new Set([...interests, ...prefInterests])].map((i) => i.toLowerCase());

  const hotelName = ctx.hotel?.name ?? ctx.booking.hotelName ?? "your hotel";
  const serviceKey = stayServiceKey(ctx.booking, ctx.hotel);
  const experiences = serviceKey
    ? await db.experience.findMany({
        where: { hotelKey: serviceKey, available: true },
        orderBy: { distanceKm: "asc" },
      })
    : [];

  const wanted = new Set<string>();
  for (const i of allInterests) {
    for (const cat of INTEREST_TO_CATEGORIES[i] ?? [i]) wanted.add(cat);
  }
  const ranked = [...experiences].sort((a, b) => {
    const aw = wanted.has(a.category) ? 2 : 0;
    const bw = wanted.has(b.category) ? 2 : 0;
    if (aw !== bw) return bw - aw;
    if (budgetInr != null) {
      const aFits = (a.priceInr ?? 0) <= budgetInr ? 1 : 0;
      const bFits = (b.priceInr ?? 0) <= budgetInr ? 1 : 0;
      if (aFits !== bFits) return bFits - aFits;
    }
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  const nights = Math.max(
    1,
    Math.round(
      (new Date(ctx.booking.checkOut).getTime() - new Date(ctx.booking.checkIn).getTime()) /
        86_400_000,
    ),
  );

  // rotate picks so REGENERATE gives a fresh plan from the same catalog
  const offset = Date.now() % Math.max(1, ranked.length);
  const picks = ranked.length ? [...ranked.slice(offset), ...ranked.slice(0, offset)] : [];

  const days: StayDay[] = [];
  const start = new Date(new Date(ctx.booking.checkIn).toDateString());
  const checkinTime = prefs?.checkinTime ?? "15:00";
  const checkoutTime = prefs?.checkoutTime ?? "11:00";
  let pickIdx = 0;
  const takeExp = (): typeof ranked[number] | null =>
    picks.length ? picks[pickIdx++ % picks.length] : null;

  for (let dayNum = 1; dayNum <= nights + 1; dayNum++) {
    const d = new Date(start);
    d.setDate(start.getDate() + dayNum - 1);
    const items: ItinItem[] = [];

    if (dayNum === 1) {
      items.push({ time: fmtTime(checkinTime), emoji: "🏨", title: `Check in at ${hotelName}`, detail: `Booking ${ctx.booking.code}` });
      items.push({ time: "4:30 PM", emoji: "🧭", title: "Get your bearings", detail: ctx.hotel?.city ?? ctx.booking.destinationLabel ?? "the neighbourhood" });
      addEvening(items, ctx.hotel?.localTips ?? "[]");
    } else if (dayNum === nights + 1) {
      items.push({ time: "8:00 AM", emoji: "☕", title: "Slow breakfast", detail: `Last morning at ${hotelName} — pack at leisure` });
      items.push({ time: fmtTime(checkoutTime), emoji: "🧳", title: "Checkout", detail: "Unified bill settles from your wallet" });
    } else {
      items.push({ time: "8:00 AM", emoji: "☕", title: "Breakfast at the hotel" });
      const morning = takeExp();
      if (morning) {
        items.push({
          time: "10:00 AM",
          emoji: morning.emoji,
          title: morning.name,
          detail: `${(morning.distanceKm).toFixed(1)} km · ${morning.durationHours ?? 2} h${morning.priceInr ? ` · ₹${morning.priceInr.toLocaleString("en-IN")}` : " · often free"}`,
        });
      }
      items.push({ time: "1:00 PM", emoji: "🍴", title: "Lunch", detail: "Ask the concierge for today's special" });
      const afternoon = takeExp();
      if (afternoon && afternoon.id !== morning?.id) {
        items.push({
          time: "3:30 PM",
          emoji: afternoon.emoji,
          title: afternoon.name,
          detail: `${afternoon.distanceKm.toFixed(1)} km · ${afternoon.durationHours ?? 2} h`,
        });
      }
      addEvening(items, ctx.hotel?.localTips ?? "[]");
    }

    days.push({
      date: d.toISOString().slice(0, 10),
      label: fmt(d),
      items,
    });
  }

  function fmtTime(t: string): string {
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h)) return t;
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
  }

  function addEvening(items: ItinItem[], tips: string) {
    const eveningExp = takeExp();
    if (eveningExp && ["restaurants", "events"].includes(eveningExp.category)) {
      items.push({
        time: eveningExp.category === "events" ? "7:30 PM" : "8:00 PM",
        emoji: eveningExp.emoji,
        title: eveningExp.name,
        detail: `${eveningExp.distanceKm.toFixed(1)} km${eveningExp.priceInr ? ` · ₹${eveningExp.priceInr.toLocaleString("en-IN")}` : ""}`,
      });
    } else {
      items.push({ time: "8:00 PM", emoji: "🍽️", title: "Dinner at the hotel restaurant" });
    }
    const tipList = JSON.parse(tips || "[]") as string[];
    if (tipList.length) {
      items.push({
        time: "9:30 PM",
        emoji: "🌙",
        title: tipList[Math.floor(Date.now() / 86_400_000) % tipList.length],
      });
    }
  }

  // persist (regenerate overwrites — itinerary is derived data, not billing state)
  await db.booking.update({
    where: { id: ctx.booking.id },
    data: { itinerary: JSON.stringify(days) },
  });

  return NextResponse.json({ success: true, days, basis: {
    interests: allInterests,
    budgetInr,
    catalogSize: experiences.length,
  } });
}

/** GET — return the saved itinerary. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code: decodeURIComponent(code) },
    select: { itinerary: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  let days: StayDay[] = [];
  try {
    days = JSON.parse(booking.itinerary || "[]");
  } catch {
    days = [];
  }
  return NextResponse.json({ days });
}
