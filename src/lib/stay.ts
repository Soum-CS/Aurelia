/**
 * My Aurelia Stay — shared server-side domain logic.
 *
 * Everything here works on REAL stored data (bookings, food orders,
 * service requests, experience bookings, wallet transactions). Nothing
 * in this file fabricates success states; statuses only advance through
 * explicit backend transitions (guest actions or staff/admin routes).
 */

import { db } from "./db";
import { getUsdToInrRate } from "./currency";
import { parseStringArray } from "./data";

/* ── Stay status lifecycle ──────────────────────────────────────────── */
/* BOOKED → PRE-ARRIVAL → CHECKED-IN → IN-STAY → CHECKOUT → COMPLETED   */

export type StayStage =
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "BOOKED"
  | "PRE_ARRIVAL"
  | "CHECKED_IN"
  | "IN_STAY"
  | "CHECKOUT"
  | "COMPLETED";

export const STAGE_ORDER: StayStage[] = [
  "BOOKED",
  "PRE_ARRIVAL",
  "CHECKED_IN",
  "IN_STAY",
  "CHECKOUT",
  "COMPLETED",
];

export function deriveStayStage(booking: {
  status: string;
  preArrival: string;
  checkIn: Date;
  checkOut: Date;
  checkedOutAt?: Date | null;
  checkedInAt?: Date | null;
}): StayStage {
  switch (booking.status) {
    case "PENDING_PAYMENT":
      return "PAYMENT_PENDING";
    case "PAYMENT_FAILED":
      return "PAYMENT_FAILED";
    case "CONFIRMED": {
      try {
        const pre = JSON.parse(booking.preArrival ?? "{}");
        if (pre && typeof pre === "object" && Object.keys(pre).length > 0) {
          return "PRE_ARRIVAL";
        }
      } catch {
        /* unparseable pre-arrival stays BOOKED */
      }
      return "BOOKED";
    }
    case "CHECKED_IN": {
      const now = Date.now();
      const checkoutDue = booking.checkOut.getTime();
      // Checkout window opens 12 h before the published checkout time.
      if (now >= checkoutDue - 12 * 3600_000) return "CHECKOUT";
      const checkedInAt = booking.checkedInAt?.getTime() ?? now;
      if (now - checkedInAt < 2 * 3600_000) return "CHECKED_IN";
      return "IN_STAY";
    }
    case "CHECKED_OUT":
      return "COMPLETED";
    default:
      return booking.status === "CANCELLED" ? "COMPLETED" : "BOOKED";
  }
}

export function stageLabel(stage: StayStage): string {
  return {
    PAYMENT_PENDING: "Payment pending",
    PAYMENT_FAILED: "Payment failed",
    BOOKED: "Booked",
    PRE_ARRIVAL: "Pre-arrival",
    CHECKED_IN: "Checked in",
    IN_STAY: "In-stay",
    CHECKOUT: "Checkout",
    COMPLETED: "Completed",
  }[stage];
}

export interface Countdown {
  label: string;
  ms: number;
  text: string;
}

export function countdownTo(target: Date, now = new Date()): Countdown | null {
  const ms = target.getTime() - now.getTime();
  const label = ms >= 0 ? "Until" : "Past";
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const text =
    days > 0
      ? `${days}d ${hours}h`
      : hours > 0
        ? `${hours}h ${mins}m`
        : `${mins}m`;
  return { label, ms, text };
}

/* ── Hotel resolution for a booking ─────────────────────────────────── */
/**
 * Stay services (dining, experiences) belong to ONE hotel. Resolve the
 * Prisma Hotel for a booking: prefer the roomType relation, then a stored
 * hotelId, then an exact name match (persisted once). Returns null when
 * the stay's hotel has no Aurelia property record — callers must surface
 * a transparent "not configured for this hotel" state instead of guessing.
 */
export async function resolveHotelForBooking(booking: {
  id: string;
  hotelId?: string | null;
  hotelName?: string | null;
  roomTypeId?: string | null;
}) {
  if (booking.roomTypeId) {
    const rt = await db.roomType.findUnique({
      where: { id: booking.roomTypeId },
      select: { hotelId: true },
    });
    if (rt) return db.hotel.findUnique({ where: { id: rt.hotelId } });
  }
  if (booking.hotelId) {
    return db.hotel.findUnique({ where: { id: booking.hotelId } });
  }
  if (booking.hotelName) {
    const match = await db.hotel.findFirst({
      where: { name: { equals: booking.hotelName.trim() } },
    });
    if (match) {
      await db.booking.update({
        where: { id: booking.id },
        data: { hotelId: match.id },
      });
      return match;
    }
  }
  return null;
}

/* ── Food ordering money rules ──────────────────────────────────────── */

export const FOOD_TAX_RATE = 0.05;
export const FOOD_SERVICE_CHARGE_RATE = 0; // off by default; hotels vary

export interface ParsedMenuItemAddon {
  name: string;
  priceInr: number;
}

export function parseMenuAddons(json: string): ParsedMenuItemAddon[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is ParsedMenuItemAddon =>
        a && typeof a.name === "string" && typeof a.priceInr === "number",
    );
  } catch {
    return [];
  }
}

/* ── Wallet & unified bill ──────────────────────────────────────────── */

export const WALLET_CATEGORIES = [
  "ROOM",
  "FOOD",
  "SERVICES",
  "SPA",
  "LAUNDRY",
  "ACTIVITIES",
  "TRANSPORTATION",
  "OTHER",
] as const;
export type WalletCategory = (typeof WALLET_CATEGORIES)[number];

export function serviceRequestCategory(kind: string, title: string): WalletCategory {
  const t = `${kind} ${title}`.toLowerCase();
  if (kind === "SPA") return "SPA";
  if (/laundry|dry clean|wash/.test(t)) return "LAUNDRY";
  if (kind === "ROOM_SERVICE") return "FOOD";
  if (
    kind === "HOUSEKEEPING" ||
    kind === "ISSUE" ||
    kind === "CONCIERGE_TICKET"
  )
    return "SERVICES";
  return "OTHER";
}

/**
 * Ensure exactly one ROOM transaction exists per booking (the accommodation
 * charge). Uses the booking's own recorded totals; USD amounts are converted
 * with the live rate and provenance is kept on the row. Idempotent.
 */
export async function ensureRoomWalletTxn(
  booking: {
    id: string;
    code: string;
    total: number;
    totalInr?: number | null;
    taxesFees: number;
    paymentStatus?: string | null;
    inrRateUsed?: number | null;
    currency?: string | null;
  },
): Promise<void> {
  const ref = `ROOM-${booking.code}`;
  const existing = await db.walletTransaction.findUnique({ where: { ref } });
  if (existing) return;

  let amountInr: number;
  let rateLive = true;
  if (booking.currency === "INR" && booking.totalInr != null) {
    amountInr = Math.round(booking.totalInr);
    rateLive = true;
  } else {
    const rateInfo = await getUsdToInrRate();
    amountInr = Math.round(booking.total * rateInfo.rate);
    rateLive = rateInfo.live;
  }
  await db.walletTransaction.create({
    data: {
      bookingId: booking.id,
      ref,
      category: "ROOM",
      label: "Accommodation · room + taxes",
      amountInr,
      taxInr:
        booking.currency === "INR"
          ? 0 // dataset flow quotes are tax-inclusive
          : Math.round(booking.taxesFees * (booking.inrRateUsed ?? 1)),
      status: "PAID", // accommodation is settled at booking time
      source: "BOOKING",
      sourceId: booking.id,
      rateLive,
    },
  });
}

export interface BillSection {
  category: WalletCategory;
  title: string;
  lines: { ref: string; label: string; amountInr: number; taxInr: number; status: string; at: Date }[];
  subtotalInr: number;
}

export interface UnifiedBill {
  sections: BillSection[];
  subtotalInr: number;
  discountsInr: number;
  serviceChargeInr: number;
  taxesIncludedInr: number;
  paidInr: number;
  pendingInr: number;
  refundsInr: number;
  grandTotalInr: number;
}

export async function getWalletTxns(bookingId: string) {
  return db.walletTransaction.findMany({
    where: { bookingId, status: { not: "REFUNDED" } },
    orderBy: { createdAt: "asc" },
  });
}

export function buildUnifiedBill(
  txns: {
    ref: string;
    category: string;
    label: string;
    amountInr: number;
    taxInr: number;
    status: string;
    createdAt: Date;
  }[],
): UnifiedBill {
  const titles: Record<string, string> = {
    ROOM: "Accommodation",
    FOOD: "Food & dining",
    SERVICES: "Services",
    SPA: "Spa & wellness",
    LAUNDRY: "Laundry",
    ACTIVITIES: "Experiences",
    TRANSPORTATION: "Transportation",
    OTHER: "Other charges",
  };
  const map = new Map<string, BillSection>();
  for (const txn of txns) {
    const cat = (WALLET_CATEGORIES as readonly string[]).includes(txn.category)
      ? txn.category
      : "OTHER";
    if (!map.has(cat)) {
      map.set(cat, {
        category: cat as WalletCategory,
        title: titles[cat] ?? "Charges",
        lines: [],
        subtotalInr: 0,
      });
    }
    const section = map.get(cat)!;
    section.lines.push({
      ref: txn.ref,
      label: txn.label,
      amountInr: txn.amountInr,
      taxInr: txn.taxInr,
      status: txn.status,
      at: txn.createdAt,
    });
    section.subtotalInr += txn.amountInr;
  }
  const order = ["ROOM", "FOOD", "SERVICES", "SPA", "LAUNDRY", "ACTIVITIES", "TRANSPORTATION", "OTHER"];
  const sections = order
    .filter((c) => map.has(c))
    .map((c) => map.get(c)!);

  const subtotalInr = sections.reduce((s, sec) => s + sec.subtotalInr, 0);
  const discountsInr = 0; // refunds tracked separately; promo engine later
  const serviceChargeInr = 0; // already inside line amounts — never duplicated
  const taxesIncludedInr = txns.reduce((s, t) => s + t.taxInr, 0);
  const paidInr = txns.filter((t) => t.status === "PAID").reduce((s, t) => s + t.amountInr, 0);
  const pendingInr = txns.filter((t) => t.status === "PENDING").reduce((s, t) => s + t.amountInr, 0);
  const refundsInr = 0;

  return {
    sections,
    subtotalInr,
    discountsInr,
    serviceChargeInr,
    taxesIncludedInr,
    paidInr,
    pendingInr,
    refundsInr,
    grandTotalInr: subtotalInr - discountsInr + serviceChargeInr,
  };
}

/* ── Stay dining & experience anchors ───────────────────────────────── */
/**
 * Stable service anchor for a booking: the Prisma hotel id when the stay's
 * property is in the catalog, or "csv:<dataset id>" for dataset bookings.
 * Returns null when the booking has no resolvable property at all.
 */
export function stayServiceKey(
  booking: { provider?: string | null; providerBookingId?: string | null; hotelId?: string | null; hotelName?: string | null },
  hotel?: { id: string } | null,
): string | null {
  if (hotel) return hotel.id;
  if (booking.provider === "csv-dataset" && booking.providerBookingId) {
    return `csv:${booking.providerBookingId}`;
  }
  if (booking.hotelId) {
    return `hotel:${booking.hotelId}`;
  }
  if (booking.hotelName) {
    return `name:${booking.hotelName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  }
  return "demo:kitchen";
}


/* Deterministic hash so each dataset hotel gets its own menu variation. */
function hashKey(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Get (or lazily provision) the booked hotel's own restaurant. Dataset
 * bookings without a catalog record get a clearly-labeled demo kitchen —
 * same precedent as the procedural "concept twin" 3D rooms. Catalog
 * restaurants always win; demo kitchens are never presented as live data.
 */
export async function ensureRestaurantForStay(
  booking: { provider?: string | null; providerBookingId?: string | null; hotelName?: string | null },
  hotel?: { id: string } | null,
) {
  const key = stayServiceKey(booking, hotel);
  if (!key) return null;

  const existing = await db.restaurant.findUnique({
    where: { hotelKey: key },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;

  const seed = SEED_DEMO_KITCHEN(key, booking.hotelName ?? "Your Hotel");
  await db.restaurant.create({ data: { hotelKey: seed.hotelKey, name: seed.name, cuisine: seed.cuisine, summary: seed.summary, hours: seed.hours, dataProvenance: seed.dataProvenance } });
  const restaurant = await db.restaurant.findUnique({ where: { hotelKey: key } });
  if (!restaurant) return null;
  let catOrder = 0;
  for (const cat of seed.categories) {
    const category = await db.menuCategory.create({
      data: { restaurantId: restaurant.id, name: cat.name, sortOrder: catOrder++ },
    });
    let iOrder = 0;
    for (const item of cat.items) {
      await db.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: item.n,
          description: item.d,
          priceInr: item.p,
          diet: item.diet,
          prepMinutes: item.prep,
          spiceLevel: item.spice,
          tags: JSON.stringify(item.tags),
          allergens: JSON.stringify([]),
          imageEmoji: item.emoji,
          sortOrder: iOrder++,
          available: true,
        },
      });
    }
  }
  return db.restaurant.findUnique({
    where: { hotelKey: key },
    include: { categories: { orderBy: { sortOrder: "asc" } } },
  });
}

interface DemoItem {
  n: string;
  d: string;
  p: number;
  diet: "VEG" | "NON_VEG" | "VEGAN" | "EGG";
  prep: number;
  spice: number;
  tags: string[];
  emoji: string;
}

const DEMO_ITEMS: DemoItem[] = [
  { n: "Chicken Biryani", d: "Spicy aromatic basmati rice layered with chicken and traditional spices", p: 420, diet: "NON_VEG", prep: 25, spice: 2, tags: ["spicy", "high-protein"], emoji: "🍛" },
  { n: "Paneer Butter Masala", d: "Silky tomato-cashew gravy, charred paneer", p: 340, diet: "VEG", prep: 22, spice: 1, tags: ["high-protein"], emoji: "🥘" },
  { n: "Dal Tadka + Jeera Rice", d: "Yellow lentils with ghee tempering", p: 260, diet: "VEG", prep: 18, spice: 1, tags: ["healthy"], emoji: "🍲" },
  { n: "Tandoori Wrap", d: "Clay-oven chicken, pickled onion, mint raita", p: 350, diet: "NON_VEG", prep: 18, spice: 2, tags: ["spicy"], emoji: "🌮" },
  { n: "Schezwan Noodles", d: "Wok-tossed noodles, house schezwan sauce", p: 390, diet: "VEG", prep: 20, spice: 3, tags: ["spicy"], emoji: "🍜" },
  { n: "Veg Soup of the Day", d: "Slow-simmered seasonal vegetables", p: 220, diet: "VEGAN", prep: 10, spice: 0, tags: ["healthy", "low-cal"], emoji: "🥣" },
  { n: "Grilled Fish of the Day", d: "Lemon butter, seasonal greens", p: 640, diet: "NON_VEG", prep: 24, spice: 0, tags: ["high-protein"], emoji: "🐠" },
  { n: "Palak Paneer + Naan", d: "Silken spinach gravy, garlic naan", p: 340, diet: "VEG", prep: 22, spice: 1, tags: [], emoji: "🥬" },
  { n: "Margherita Pizza", d: "Hand-stretched dough, fior di latte", p: 320, diet: "VEG", prep: 16, spice: 0, tags: ["kids"], emoji: "🍕" },
  { n: "Caesar Salad", d: "Crisp romaine, parmesan, sourdough crumb", p: 290, diet: "EGG", prep: 10, spice: 0, tags: ["healthy"], emoji: "🥗" },
  { n: "Masala Dosa", d: "Crisp rice crêpe, spiced potato, chutneys", p: 220, diet: "VEG", prep: 15, spice: 1, tags: ["breakfast"], emoji: "🥞" },
  { n: "Eggs Your Way + Toast", d: "Two eggs, buttered sourdough", p: 240, diet: "EGG", prep: 12, spice: 0, tags: ["breakfast"], emoji: "🍳" },
  { n: "Poha Bowl", d: "Flattened rice, curry leaves, peanuts, lime", p: 160, diet: "VEG", prep: 10, spice: 1, tags: ["breakfast", "healthy"], emoji: "🍚" },
  { n: "Avocado Toast", d: "Smashed avocado, chilli flakes, dukkah", p: 340, diet: "VEGAN", prep: 12, spice: 0, tags: ["breakfast", "healthy"], emoji: "🥑" },
  { n: "Fresh Lime Soda", d: "Sweet, salted or mixed", p: 100, diet: "VEGAN", prep: 4, spice: 0, tags: [], emoji: "🍹" },
  { n: "Filter Coffee", d: "Slow-brewed, robust", p: 120, diet: "VEG", prep: 6, spice: 0, tags: ["breakfast"], emoji: "☕" },
  { n: "Masala Chai", d: "Assam leaf tea, ginger, cardamom", p: 90, diet: "VEG", prep: 8, spice: 0, tags: [], emoji: "🫖" },
  { n: "Gulab Jamun (2 pc)", d: "Warm milk dumplings, saffron syrup", p: 150, diet: "VEG", prep: 5, spice: 0, tags: [], emoji: "🍮" },
  { n: "Dark Chocolate Fondant", d: "70% single-origin, molten centre", p: 290, diet: "EGG", prep: 15, spice: 0, tags: [], emoji: "🍫" },
  { n: "Fresh Fruit Plate", d: "Seasonal cut fruit", p: 180, diet: "VEGAN", prep: 6, spice: 0, tags: ["healthy", "low-cal"], emoji: "🍈" },
];

function SEED_DEMO_KITCHEN(key: string, hotelName: string) {
  const h = hashKey(key);
  const name = `${hotelName} · In-room dining`;
  const offset = h % DEMO_ITEMS.length;
  const rotated = [...DEMO_ITEMS.slice(offset), ...DEMO_ITEMS.slice(0, offset)];
  const categories: Array<{ name: string; items: DemoItem[] }> = [
    { name: "Breakfast", items: rotated.filter((i) => i.tags.includes("breakfast")) },
    { name: "Starters", items: rotated.filter((i) => i.spice > 0 && !i.tags.includes("breakfast")).slice(0, 3) },
    { name: "Main Course", items: rotated.filter((i) => i.p >= 300 && i.spice <= 2).slice(0, 6) },
    { name: "Desserts", items: rotated.slice(-4).slice(0, 2) },
    { name: "Beverages", items: rotated.filter((i) => ["🍹", "☕", "🫖"].includes(i.emoji)) },
  ].filter((c) => c.items.length > 0);

  return {
    hotelKey: key,
    name,
    cuisine: "Multi-cuisine",
    summary: `${hotelName}'s in-room dining kitchen, served to your door.`,
    hours: JSON.stringify({ breakfast: "07:00–10:30", lunch: "12:00–15:00", dinner: "19:00–23:00" }),
    dataProvenance: "demo",
    categories,
  };
}

/* ── Food recommendation engine (real menu items only) ──────────────── */

export interface RecConstraints {
  maxPriceInr?: number;
  diets?: string[]; // vegetarian vegan jain nonveg egg
  spicy?: boolean;
  healthy?: boolean;
  highProtein?: boolean;
  lowCalorie?: boolean;
  kids?: boolean;
  mealType?: string; // breakfast lunch dinner snacks drinks desserts
  cuisines?: string[]; // indian chinese continental…
  allergies?: string[];
  limit?: number;
}

export interface RecommendedItem {
  id: string;
  name: string;
  description: string;
  priceInr: number;
  diet: string;
  emoji: string;
  prepMinutes: number;
  calories: number | null;
  categoryName: string;
  available: boolean;
  reasons: string[];
}

const JAIN_HINT = /(onion|garlic|potato|root)/i;

export function recommendFromMenu<
  T extends {
    id: string;
    name: string;
    description: string;
    priceInr: number;
    diet: string;
    imageEmoji: string;
    prepMinutes: number;
    calories: number | null;
    proteinG: number | null;
    spiceLevel: number;
    tags: string;
    allergens: string;
    ingredients: string | null;
    available: boolean;
    category?: { name: string } | null;
  },
>(items: T[], c: RecConstraints): RecommendedItem[] {
  const scored: (RecommendedItem & { score: number })[] = [];
  const diets = new Set((c.diets ?? []).map((d) => d.toLowerCase()));
  const wantsVegOnly =
    diets.has("vegetarian") || diets.has("vegan") || diets.has("jain");

  for (const item of items) {
    if (!item.available) continue;
    if (c.maxPriceInr != null && item.priceInr > c.maxPriceInr) continue;
    const tags = parseStringArray(item.tags);
    const allergens = parseStringArray(item.allergens);

    // Diet filters — hard constraints
    if (diets.has("vegan") && item.diet !== "VEGAN") continue;
    if (diets.has("jain")) {
      if (item.diet !== "VEG" && item.diet !== "VEGAN") continue;
      if (JAIN_HINT.test(`${item.ingredients ?? ""} ${item.description}`)) continue;
      if (!tags.includes("jain") && /onion|garlic/i.test(`${item.ingredients ?? ""}`)) continue;
    }
    if ((diets.has("vegetarian") || wantsVegOnly) && !diets.has("nonveg")) {
      if (!["VEG", "VEGAN"].includes(item.diet)) continue;
    }
    if (c.mealType) {
      const cat = (item.category?.name ?? "").toLowerCase();
      const mt = c.mealType.toLowerCase();
      const matches =
        cat.includes(mt) ||
        tags.includes(mt) ||
        (mt === "drinks" && cat.includes("beverage"));
      if (!matches) continue;
    }
    if (c.allergies?.length) {
      const fullText = `${item.name} ${item.description ?? ""} ${item.ingredients ?? ""} ${allergens.join(" ")}`.toLowerCase();
      const hasAllergen = c.allergies.some((al) => {
        const aClean = al.trim().toLowerCase();
        if (!aClean) return false;
        return fullText.includes(aClean) || allergens.some((x) => x.toLowerCase().includes(aClean));
      });
      if (hasAllergen) continue;
    }

    let score = 1;
    const reasons: string[] = [];
    if (c.maxPriceInr != null) {
      reasons.push(`₹${item.priceInr} · under your ₹${c.maxPriceInr} budget`);
      score += 2;
    }
    if (c.spicy && (item.spiceLevel >= 2 || tags.includes("spicy") || /spicy|chilli|chili|pepper|schezwan/i.test(`${item.name} ${item.description}`))) {
      reasons.push("spicy");
      score += 3;
    }
    if (c.healthy && (tags.includes("healthy") || tags.includes("low-cal") || /salad|steamed|grilled/i.test(item.name))) {
      reasons.push("healthy pick");
      score += 3;
    }
    if (c.lowCalorie && ((item.calories != null && item.calories <= 350) || tags.includes("low-cal"))) {
      reasons.push(`~${item.calories ?? 300} kcal`);
      score += 2;
    }
    if (c.highProtein && ((item.proteinG != null && item.proteinG >= 15) || tags.includes("high-protein"))) {
      reasons.push(`${item.proteinG ?? 18} g protein`);
      score += 3;
    }
    if (c.kids && tags.includes("kids")) {
      reasons.push("kid-friendly");
      score += 4;
    }
    if (c.cuisines?.length) {
      const cat = (item.category?.name ?? "").toLowerCase();
      const CUISINE_MAP: Record<string, RegExp> = {
        indian: /indian|biryani|tikka|paneer|dal|dosa|poha|idli|sambar|chai|curry|tandoori|naan|roti|shrikhand|gulab|jamun|chole|bhature/i,
        chinese: /chinese|noodles|schezwan|dan dan|mapo|tofu|spring roll|kaufau|dumpling|dim sum|kung pao|wok/i,
        continental: /continental|burger|fondue|rösti|roesti|toast|avocado|benedict|pancake|sandwich|grill|smash/i,
        mediterranean: /mediterranean|tapas|paella|bacalhau|gazpacho|halloumi|olive|hummus|pita/i,
        italian: /italian|pizza|risotto|pasta|burrata|margherita|spaghetti|gnocchi/i,
      };

      for (const cu of c.cuisines) {
        const cLower = cu.toLowerCase();
        const rx = CUISINE_MAP[cLower];
        if (cat.includes(cLower) || tags.includes(cLower) || (rx && rx.test(`${item.name} ${item.description}`))) {
          reasons.push(cLower.charAt(0).toUpperCase() + cLower.slice(1));
          score += 4;
          break;
        }
      }
    }
    if (tags.includes("chef-special")) score += 1;

    scored.push({
      id: item.id,
      name: item.name,
      description: item.description,
      priceInr: item.priceInr,
      diet: item.diet,
      emoji: item.imageEmoji,
      prepMinutes: item.prepMinutes,
      calories: item.calories,
      categoryName: item.category?.name ?? "",
      available: item.available,
      reasons,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.priceInr - b.priceInr);
  return scored.slice(0, c.limit ?? 6).map((entry) => {
    const { score: _score, ...rest } = entry;
    void _score;
    return rest;
  });
}
