import { db } from "./db";
import { nightsBetween } from "./format";
import { haversineKm } from "./geo";

export function parseStringArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export interface HotelSummary {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  tagline: string;
  description: string;
  rating: number;
  reviewCount: number;
  amenities: string[];
  localTips: string[];
  weather: { tempC: number; condition: string; packing: string };
  artSeed: number;
  featured: boolean;
  roomCount: number;
  priceFrom: number;
  distanceKm?: number;
}

const DEFAULT_WEATHER = { tempC: 20, condition: "Pleasant", packing: "Layers" };

function toSummary(hotel: {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  tagline: string;
  description: string;
  rating: number;
  reviewCount: number;
  amenities: string;
  localTips: string;
  weather: string;
  artSeed: number;
  featured: boolean;
  roomTypes: { basePrice: number; capacity?: number }[];
}): HotelSummary {
  const prices = hotel.roomTypes.map((r) => r.basePrice);
  return {
    id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    city: hotel.city,
    country: hotel.country,
    address: hotel.address,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    tagline: hotel.tagline,
    description: hotel.description,
    rating: hotel.rating,
    reviewCount: hotel.reviewCount,
    amenities: parseStringArray(hotel.amenities),
    localTips: parseStringArray(hotel.localTips),
    weather: parseJsonObject(hotel.weather, DEFAULT_WEATHER),
    artSeed: hotel.artSeed,
    featured: hotel.featured,
    roomCount: hotel.roomTypes.length,
    priceFrom: prices.length ? Math.min(...prices) : 0,
  };
}

const HOTEL_INCLUDE = {
  roomTypes: { select: { basePrice: true, capacity: true } },
};

export async function listHotels(params: {
  q?: string;
  guests?: number;
  from?: { latitude: number; longitude: number };
} = {}): Promise<HotelSummary[]> {
  const q = params.q?.trim().toLowerCase();
  const hotels = await db.hotel.findMany({
    where: q
      ? {
          OR: [
            { city: { contains: q } },
            { country: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : undefined,
    include: HOTEL_INCLUDE,
  });
  let summaries = hotels.map((h) => toSummary(h));
  if (params.guests && params.guests > 0) {
    summaries = summaries.filter(
      (h) =>
        hotels
          .find((raw) => raw.id === h.id)
          ?.roomTypes.some((r) => r.capacity >= params.guests!),
    );
  }
  if (params.from) {
    const from = params.from;
    summaries = summaries
      .map((h) => ({ ...h, distanceKm: haversineKm(from, h) }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }
  return summaries;
}

export async function listCities(): Promise<string[]> {
  const hotels = await db.hotel.findMany({
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });
  return hotels.map((h) => h.city);
}

export async function getHotelBySlug(slug: string) {
  const hotel = await db.hotel.findUnique({
    where: { slug },
    include: { roomTypes: { orderBy: { basePrice: "asc" } } },
  });
  if (!hotel) return null;
  return {
    ...toSummary({ ...hotel }),
    rooms: hotel.roomTypes.map((r) => ({
      ...r,
      amenities: parseStringArray(r.amenities),
      accessibilityFeatures: parseStringArray(r.accessibilityFeatures),
    })),
  };
}

export async function getRoomTypeById(id: string) {
  const room = await db.roomType!.findUnique({
    where: { id },
    include: { hotel: true },
  });
  if (!room) return null;
  return {
    ...room,
    amenities: parseStringArray(room.amenities),
    accessibilityFeatures: parseStringArray(room.accessibilityFeatures),
    hotel: {
      ...room.hotel,
      amenities: parseStringArray(room.hotel.amenities),
      localTips: parseStringArray(room.hotel.localTips),
      weather: parseJsonObject(room.hotel.weather, DEFAULT_WEATHER),
    },
  };
}

export async function getAvailableUnits(
  roomTypeId: string,
  checkInISO: string,
  checkOutISO: string,
  excludeBookingId?: string
): Promise<number> {
  const room = await db.roomType!.findUnique({
    where: { id: roomTypeId },
    select: { unitsAvailable: true },
  });
  if (!room) return 0;
  if (!checkInISO || !checkOutISO || nightsBetween(checkInISO, checkOutISO) <= 0) {
    return room.unitsAvailable;
  }
  const overlapping = await db.booking.count({
    where: {
      roomTypeId,
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      checkIn: { lt: new Date(checkOutISO) },
      checkOut: { gt: new Date(checkInISO) },
    },
  });
  return Math.max(room.unitsAvailable - overlapping, 0);
}

export interface BookingResolvedRoomType {
  id: string;
  hotelId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  maxGuests: number;
  unitsAvailable: number;
  roomSizeSqFt: number;
  bedType: string;
  amenities: string[];
  accessibilityFeatures: string[];
  images: string;
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    state?: string;
    country: string;
    address: string;
    rating: number;
    reviewsCount?: number;
    reviewCount?: number;
    artSeed: number;
    amenities: string[];
    localTips: string[];
    weather: { tempC: number; condition: string; packing: string };
    faq: any[];
    checkInTime?: string;
    checkOutTime?: string;
    coverImage?: string;
    images?: string;
  };
}

async function resolveBookingRoomAndHotel(booking: {
  roomType?: any;
  hotelId?: string | null;
  hotelName?: string | null;
  roomName?: string | null;
  destinationLabel?: string | null;
  providerBookingId?: string | null;
  pricePerNight?: number | null;
  subtotal: number;
  nights: number;
  guests: number;
}): Promise<BookingResolvedRoomType> {
  let roomType = null;
  if (booking.roomType) {
    roomType = {
      ...booking.roomType,
      amenities: parseStringArray(booking.roomType.amenities),
      accessibilityFeatures: parseStringArray(booking.roomType.accessibilityFeatures),
      hotel: booking.roomType.hotel
        ? {
            ...booking.roomType.hotel,
            amenities: parseStringArray(booking.roomType.hotel.amenities),
            localTips: parseStringArray(booking.roomType.hotel.localTips),
            weather: parseJsonObject(booking.roomType.hotel.weather, DEFAULT_WEATHER),
            faq: JSON.parse(booking.roomType.hotel.faq ?? "[]"),
          }
        : null,
    };
  }

  if (!roomType || !roomType.hotel) {
    let csvHotel: any = null;
    if (booking.providerBookingId) {
      try {
        const { getDatasetHotel } = await import("@/lib/hotels/csv-provider");
        csvHotel = await getDatasetHotel(booking.providerBookingId);
      } catch {
        csvHotel = null;
      }
    }

    const hotelObj = {
      id: csvHotel ? String(csvHotel.id) : (booking.hotelId ?? "hotel-external"),
      name: csvHotel ? csvHotel.name : (booking.hotelName ?? "Aurelia Hotel"),
      slug: csvHotel
        ? String(csvHotel.id)
        : booking.hotelName
        ? booking.hotelName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : "aurelia-hotel",
      city: csvHotel ? csvHotel.city : (booking.destinationLabel?.split(",")?.[0]?.trim() ?? "Aurelia"),
      state: csvHotel ? csvHotel.state : (booking.destinationLabel?.split(",")?.[1]?.trim() ?? ""),
      country: csvHotel ? csvHotel.country : "India",
      address: csvHotel
        ? `${csvHotel.address_street_name}, ${csvHotel.city}`
        : (booking.destinationLabel ?? "Aurelia Sanctuary"),
      rating: csvHotel ? csvHotel.star_rating : 4.9,
      reviewsCount: csvHotel ? csvHotel.rating_count : 120,
      artSeed: csvHotel && typeof csvHotel.id === "number" ? csvHotel.id : 42,
      amenities: csvHotel
        ? parseStringArray(csvHotel.amenities ?? "[]")
        : ["Valet Parking", "Spa", "Fine Dining", "High-Speed WiFi", "24/7 Concierge"],
      localTips: ["Enjoy the panoramic city views", "Fine dining at the signature in-house restaurant"],
      weather: DEFAULT_WEATHER,
      faq: [],
      checkInTime: "14:00",
      checkOutTime: "11:00",
      coverImage: "/hotels/astor.webp",
      images: "[]",
    };

    roomType = {
      id: roomType?.id ?? "room-external",
      hotelId: hotelObj.id,
      name: roomType?.name ?? booking.roomName ?? "Luxury Room",
      slug: roomType?.slug ?? "luxury-room",
      description: roomType?.description ?? "A comfortable and luxurious room tailored for your stay.",
      price: roomType?.price ?? booking.pricePerNight ?? (booking.subtotal / Math.max(booking.nights, 1)),
      maxGuests: roomType?.maxGuests ?? booking.guests,
      unitsAvailable: roomType?.unitsAvailable ?? 1,
      roomSizeSqFt: roomType?.roomSizeSqFt ?? 450,
      bedType: roomType?.bedType ?? "King Bed",
      amenities: roomType?.amenities ?? ["King Bed", "High Floor", "Balcony", "Smart Room Controls", "Premium Bath Amenities"],
      accessibilityFeatures: roomType?.accessibilityFeatures ?? [],
      images: "[]",
      hotel: hotelObj,
    };
  }

  return roomType;
}

export async function getBookingByCode(code: string) {
  const booking = await db.booking.findUnique({
    where: { code },
    include: {
      roomType: { include: { hotel: true } },
      serviceRequests: { orderBy: { createdAt: "desc" } },
      review: true,
    },
  });
  if (!booking) return null;

  const roomType = await resolveBookingRoomAndHotel(booking);

  return {
    ...booking,
    addons: JSON.parse(booking.addons ?? "[]") as { id: string; label: string; amount: number }[],
    preArrival: parseJsonObject<Record<string, string>>(booking.preArrival, {}),
    roomType,
  };
}

export async function getUserBookings(userId: string) {
  const bookings = await db.booking.findMany({
    where: { userId },
    include: {
      roomType: { include: { hotel: true } },
      serviceRequests: true,
      review: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    bookings.map(async (b) => {
      const roomType = await resolveBookingRoomAndHotel(b);
      return {
        ...b,
        roomType,
      };
    })
  );
}

/* ---------- Wishlist ---------- */

export async function listWishlist(userId: string) {
  const rows = await db.wishlist.findMany({
    where: { userId },
    include: { hotel: { include: HOTEL_INCLUDE } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    savedAt: row.createdAt,
    priceAtSave: row.priceAtSave,
    hotel: toSummary({ ...row.hotel }),
  }));
}

export async function isWishlisted(userId: string | null, hotelId: string): Promise<boolean> {
  if (!userId) return false;
  const row = await db.wishlist.findUnique({
    where: { userId_hotelId: { userId, hotelId } },
  });
  return Boolean(row);
}
