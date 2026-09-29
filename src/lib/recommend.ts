import { db } from "./db";

export interface Recommendation {
  slug: string;
  name: string;
  city: string;
  country: string;
  tagline: string;
  rating: number;
  artSeed: number;
  priceFrom: number;
  reason: string;
}

const VIEW_KEYWORDS = ["ocean", "garden", "city", "skyline", "panorama", "glacier", "river", "sunset"];

/**
 * Heuristic recommender: learns from the demo guest's past stays (room views,
 * countries) and ranks hotels they haven't booked yet.
 */
export async function getRecommendations(userId?: string): Promise<Recommendation[]> {
  const [allHotels, rooms, history, userPref] = await Promise.all([
    fetchAllHotels(),
    db.roomType.findMany({ select: { hotelId: true, view: true, basePrice: true } }),
    userId
      ? db.booking.findMany({
          where: { userId, roomTypeId: { not: null } },
          include: { roomType: { select: { view: true, hotelId: true } } },
        })
      : Promise.resolve([]),
    userId
      ? db.userPreference.findUnique({ where: { userId } })
      : Promise.resolve(null),
  ]);

  const prefRoomViews: string[] = userPref ? JSON.parse(userPref.roomPrefs || "[]") : [];
  const prefBudgetInr = userPref?.budgetPerNightInr ?? null;

  const stayedHotelIds = new Set(history.map((b) => b.roomType!.hotelId));
  const viewedViews = history.map((b) => b.roomType!.view.toLowerCase());
  const stayCountries = new Set(
    history
      .map((b) => allHotels.find((h) => h.id === b.roomType!.hotelId)?.country)
      .filter(Boolean) as string[]
  );

  return allHotels
    .filter((h) => !stayedHotelIds.has(h.id))
    .map((h) => {
      let score = h.rating;
      let reason = "Loved by guests like you";

      const hotelRooms = rooms.filter((r) => r.hotelId === h.id);
      const views = hotelRooms.map((r) => r.view.toLowerCase());
      for (const viewed of viewedViews) {
        for (const kw of VIEW_KEYWORDS) {
          if (views.some((v) => v.includes(kw)) && viewed.includes(kw)) {
            score += 2.5;
            reason = `You've enjoyed ${kw}-view rooms — ${h.city} has more`;
          }
        }
      }
      for (const pv of prefRoomViews) {
        for (const kw of VIEW_KEYWORDS) {
          if (pv.includes(kw) && views.some((v) => v.includes(kw))) {
            score += 2.0;
            reason = `Matches your ${kw} view preference in ${h.city}`;
          }
        }
      }
      if (prefBudgetInr != null) {
        const fits = hotelRooms.some((r) => r.basePrice * 88 <= prefBudgetInr);
        if (fits) {
          score += 1.5;
          if (reason === "Loved by guests like you") {
            reason = `Rooms within your ₹${prefBudgetInr.toLocaleString("en-IN")} nightly budget`;
          }
        }
      }
      if (stayCountries.has(h.country)) {
        score += 1;
        if (reason === "Loved by guests like you") reason = `More of ${h.country}, since you loved it`;
      }
      return { h, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ h, reason }) => toRec(h, reason));
}

function toRec(
  h: allHotelsShape[number],
  reason: string
): Recommendation {
  return {
    slug: h.slug,
    name: h.name,
    city: h.city,
    country: h.country,
    tagline: h.tagline,
    rating: h.rating,
    artSeed: h.artSeed,
    priceFrom: Math.min(...h.roomTypes.map((r) => r.basePrice)),
    reason,
  };
}

type allHotelsShape = Awaited<ReturnType<typeof fetchAllHotels>>;
function fetchAllHotels() {
  return db.hotel.findMany({
    include: { roomTypes: { select: { basePrice: true } } },
    orderBy: [{ featured: "desc" }, { rating: "desc" }],
  });
}
