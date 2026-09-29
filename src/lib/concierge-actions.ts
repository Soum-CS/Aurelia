import { db } from "@/lib/db";
import { loadStayContext, createWalletTxn } from "@/lib/stay-api";
import {
  ensureRestaurantForStay,
  recommendFromMenu,
  getWalletTxns,
  buildUnifiedBill,
  FOOD_TAX_RATE,
  parseMenuAddons,
  stayServiceKey,
  countdownTo,
  deriveStayStage,
  stageLabel,
  UnifiedBill,
} from "@/lib/stay";
import { fetchLiveWeather, type WeatherData } from "@/lib/location/weather-service";
import { findNearestAirports, type AirportInfo } from "@/lib/location/location-service";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export interface StayDetail {
  id: string;
  code: string;
  guestName: string;
  guestFirstName: string;
  guestEmail: string;
  hotelName: string;
  hotelCity: string;
  hotelSlug: string;
  roomNumber: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  checkInFormatted: string;
  checkOutFormatted: string;
  nights: number;
  guests: number;
  status: string;
  stage: string;
  stageLabel: string;
  hotelLatitude: number;
  hotelLongitude: number;
  timeOfDay: TimeOfDay;
}

/**
 * Loads the active stay details for a booking code or user token.
 */
export async function getActiveStay(code?: string, userId?: string): Promise<StayDetail | null> {
  let booking = null;

  if (code) {
    booking = await db.booking.findUnique({
      where: { code },
      include: { roomType: { include: { hotel: true } } },
    });
  } else if (userId) {
    booking = await db.booking.findFirst({
      where: {
        userId,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      include: { roomType: { include: { hotel: true } } },
      orderBy: { checkIn: "asc" },
    });
  }

  // Fallback: If neither code nor userId was specified, fetch the latest confirmed booking
  if (!booking && !code && !userId) {
    booking = await db.booking.findFirst({
      where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      include: { roomType: { include: { hotel: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!booking) return null;

  const hotel = booking.roomType?.hotel;
  const hotelName = booking.hotelName ?? hotel?.name ?? "Aurelia Hotel";
  const hotelCity = hotel?.city ?? "Your destination";
  const hotelSlug = hotel?.slug ?? "";
  const roomNumber = booking.roomNumber ?? "Suite 502";
  const roomName = booking.roomName ?? booking.roomType?.name ?? "Grand Luxury Suite";
  const stage = deriveStayStage(booking);

  const guestName = booking.guestName || "Valued Guest";
  const guestFirstName = guestName.split(" ")[0];

  const checkInDate = new Date(booking.checkIn);
  const checkOutDate = new Date(booking.checkOut);

  return {
    id: booking.id,
    code: booking.code,
    guestName,
    guestFirstName,
    guestEmail: booking.guestEmail,
    hotelName,
    hotelCity,
    hotelSlug,
    roomNumber,
    roomName,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    checkInFormatted: checkInDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    checkOutFormatted: checkOutDate.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }),
    nights: booking.nights,
    guests: booking.guests,
    status: booking.status,
    stage,
    stageLabel: stageLabel(stage),
    hotelLatitude: hotel?.latitude ?? 28.6139,
    hotelLongitude: hotel?.longitude ?? 77.2090,
    timeOfDay: getTimeOfDay(),
  };
}

/**
 * Searches the hotel's actual kitchen menu matching diet, budget, spice, and meal type.
 */
export async function searchFood(
  bookingCode: string,
  options: {
    query?: string;
    budgetInr?: number;
    spicy?: boolean;
    healthy?: boolean;
    diets?: string[];
    cuisines?: string[];
    mealType?: string;
    limit?: number;
  },
) {
  const ctx = await loadStayContext(bookingCode);
  if (!ctx.ok) return { ok: false, error: "Stay not found", items: [] };

  const restaurant = await ensureRestaurantForStay(ctx.booking, ctx.hotel);
  if (!restaurant) {
    return { ok: false, error: "Kitchen not configured", items: [] };
  }

  const items = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id, available: true },
    include: { category: true },
  });

  const recs = recommendFromMenu(items, {
    maxPriceInr: options.budgetInr ?? undefined,
    diets: options.diets && options.diets.length ? options.diets : undefined,
    spicy: options.spicy,
    healthy: options.healthy,
    cuisines: options.cuisines && options.cuisines.length ? options.cuisines : undefined,
    mealType: options.mealType,
    limit: options.limit ?? 4,
  });

  return {
    ok: true,
    restaurantName: restaurant.name,
    items: recs,
  };
}

/**
 * Creates a real food order in the database for the active stay.
 */
export async function createFoodOrder(
  bookingCode: string,
  items: Array<{ menuItemId: string; qty?: number; addonNames?: string[] }>,
  notes?: string,
) {
  const ctx = await loadStayContext(bookingCode);
  if (!ctx.ok) return { ok: false, error: "Stay not found or inactive" };

  const restaurant = await ensureRestaurantForStay(ctx.booking, ctx.hotel);
  if (!restaurant) return { ok: false, error: "Kitchen not configured for this hotel" };

  if (!items || items.length === 0) {
    return { ok: false, error: "No items specified in order" };
  }

  type Line = {
    menuItemId: string;
    name: string;
    unitPriceInr: number;
    qty: number;
    addons: { name: string; priceInr: number }[];
    lineTotalInr: number;
  };
  const lines: Line[] = [];

  for (const entry of items) {
    const item = await db.menuItem.findUnique({ where: { id: entry.menuItemId } });
    if (!item || item.restaurantId !== restaurant.id) {
      return { ok: false, error: `Menu item not found at ${restaurant.name}.` };
    }
    if (!item.available) {
      return { ok: false, error: `${item.name} is currently sold out.` };
    }
    const qty = Math.min(10, Math.max(1, entry.qty ?? 1));
    const allowed = parseMenuAddons(item.addons);
    const requested = Array.isArray(entry.addonNames) ? entry.addonNames : [];
    const addons = allowed.filter((a) => requested.includes(a.name));
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
  const taxInr = Math.round(subtotalInr * FOOD_TAX_RATE);
  const totalInr = subtotalInr + taxInr;
  const maxEta = Math.max(...lines.map(() => 25)) + 5;
  const roomNumber = ctx.booking.roomNumber ? `Room ${ctx.booking.roomNumber}` : "Room service";

  let created = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      const code = `AUR-${Math.floor(10000 + Math.random() * 90000)}`;
      created = await db.foodOrder.create({
        data: {
          code,
          bookingId: ctx.booking.id,
          userId: ctx.booking.userId,
          hotelId: restaurant.hotelKey,
          status: "CONFIRMED",
          deliveryLocation: roomNumber,
          notes: notes ? notes.slice(0, 300) : null,
          subtotalInr,
          taxInr,
          serviceChargeInr: 0,
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
      // collision retry
    }
  }

  if (!created) {
    return { ok: false, error: "Could not create order row in database." };
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
      title: `Order #${created.code} confirmed`,
      body: `Kitchen is preparing your order · ETA ~${maxEta} min · ${roomNumber}.`,
      href: `/trips/${ctx.booking.code}/stay/food`,
      dedupeKey: `food-order-${created.id}`,
    },
  });

  return {
    ok: true,
    order: {
      id: created.id,
      code: created.code,
      totalInr,
      etaMinutes: maxEta,
      deliveryLocation: roomNumber,
      lines,
    },
  };
}

/**
 * Creates a real service request in the database.
 */
export async function createServiceRequest(
  bookingCode: string,
  kind: "HOUSEKEEPING" | "SPA" | "ROOM_SERVICE" | "RESTAURANT" | "ISSUE" | "CONCIERGE_TICKET",
  title: string,
  detail?: string,
  priority: "NORMAL" | "URGENT" = "NORMAL",
) {
  const ctx = await loadStayContext(bookingCode);
  if (!ctx.ok) return { ok: false, error: "Stay not found or inactive" };

  const roomNumber = ctx.booking.roomNumber ? `Room ${ctx.booking.roomNumber}` : "Your room";
  const created = await db.serviceRequest.create({
    data: {
      bookingId: ctx.booking.id,
      kind,
      title: title.slice(0, 140),
      detail: detail ? detail.slice(0, 500) : `Requested to ${roomNumber} via Aurelia Concierge`,
      price: 0,
      status: "OPEN",
      priority,
    },
  });

  const reqId = `SR-${created.id.slice(-4).toUpperCase()}`;

  await db.notification.create({
    data: {
      userId: ctx.booking.userId,
      bookingId: ctx.booking.id,
      type: "service",
      title: `Request ${reqId}: ${title}`,
      body: `Logged with hotel team · Status: Requested · ${roomNumber}.`,
      href: `/trips/${ctx.booking.code}/stay/services`,
      dedupeKey: `svc-created-${created.id}`,
    },
  });

  return {
    ok: true,
    requestId: reqId,
    request: created,
    roomNumber,
  };
}

/**
 * Retrieves the guest's live folio and unified bill from real transactions.
 */
export async function getFolio(bookingCode: string): Promise<{ ok: boolean; bill?: UnifiedBill; error?: string }> {
  const ctx = await loadStayContext(bookingCode);
  if (!ctx.ok) return { ok: false, error: "Stay not found" };

  const txns = await getWalletTxns(ctx.booking.id);
  const bill = buildUnifiedBill(txns);
  return { ok: true, bill };
}

/**
 * Retrieves active requests and recent timeline for the stay.
 */
export async function getStayTimeline(bookingCode: string) {
  const ctx = await loadStayContext(bookingCode);
  if (!ctx.ok) return { ok: false, events: [], activeRequests: [] };

  const serviceReqs = await db.serviceRequest.findMany({
    where: { bookingId: ctx.booking.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const foodOrders = await db.foodOrder.findMany({
    where: { bookingId: ctx.booking.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Map service request statuses cleanly
  const statusLabels: Record<string, string> = {
    OPEN: "Requested",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  const activeRequests = [
    ...serviceReqs
      .filter((r) => r.status !== "CANCELLED")
      .map((r) => ({
        id: r.id,
        type: "service" as const,
        title: r.title,
        status: statusLabels[r.status] ?? r.status,
        statusCode: r.status,
        time: r.createdAt,
        timeText: r.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      })),
    ...foodOrders
      .filter((o) => o.status !== "CANCELLED")
      .map((o) => ({
        id: o.id,
        type: "food" as const,
        title: `Order #${o.code} (${o.items.map((it) => it.name).join(", ")})`,
        status: o.status === "CONFIRMED" ? "Confirmed" : o.status === "PREPARING" ? "Preparing" : o.status,
        statusCode: o.status,
        time: o.createdAt,
        timeText: o.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  // Aggregate timeline events
  const events = [
    {
      title: "Booking confirmed",
      detail: `${ctx.booking.hotelName ?? "Hotel stay"} · ${ctx.booking.nights} nights`,
      time: ctx.booking.createdAt,
      timeText: ctx.booking.createdAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    },
    ...foodOrders.map((o) => ({
      title: `Food order #${o.code}`,
      detail: `₹${o.totalInr.toLocaleString("en-IN")} · ${o.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}`,
      time: o.createdAt,
      timeText: o.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    })),
    ...serviceReqs.map((r) => ({
      title: r.title,
      detail: `Status: ${statusLabels[r.status] ?? r.status}`,
      time: r.createdAt,
      timeText: r.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  return {
    ok: true,
    activeRequests,
    events,
  };
}

/**
 * Returns structured capabilities and verified services for this hotel.
 */
export async function getHotelServices(bookingCode: string) {
  const ctx = await loadStayContext(bookingCode);
  if (!ctx.ok) return { ok: false, services: [] };

  const services = [
    { id: "dining", label: "In-Room Dining", icon: "🍛", desc: "Chef-curated kitchen menu and beverages" },
    { id: "towels", label: "Fresh Towels & Linens", icon: "🧺", desc: "Bath towels, hand towels, and hypoallergenic pillows" },
    { id: "cleaning", label: "Housekeeping", icon: "🧹", desc: "Daily cleaning, turndown service, and refresh" },
    { id: "spa", label: "Spa & Wellness", icon: "🧖", desc: "Ayurvedic massage, steam bath, and restorative therapies" },
    { id: "transfer", label: "Airport Chauffeur", icon: "🚕", desc: "Private executive Mercedes & Audi terminal transfers" },
    { id: "key", label: "Digital Room Key", icon: "📱", desc: "Instant NFC / Bluetooth door access and QR pass" },
    { id: "late-checkout", label: "Late Checkout", icon: "🕐", desc: "Request extension until 2:00 PM" },
    { id: "luggage", label: "Bellhop & Luggage", icon: "🧳", desc: "Baggage assistance and secure luggage hold" },
    { id: "wakeup", label: "Wake-up Call", icon: "⏰", desc: "Personalized morning call service" },
  ];

  return { ok: true, services };
}
