/**
 * Hotel inventory provider abstraction.
 *
 * Aurelia's own Prisma DB stores application data (users, bookings,
 * wishlists) — NEVER live inventory. Live availability/rates come from a
 * provider behind this interface:
 *
 *   demo    → the seeded Aurelia collection (clearly labeled DEMO DATA)
 *   amadeus → Amadeus Self-Service Hotel APIs (activated purely by env vars)
 *
 * Adding another provider = one new file implementing HotelProvider.
 */

export type ProviderId = "csv-dataset" | "amadeus";

export interface ProviderHotel {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  description?: string;
  amenities: string[];
  /** Provider-authorized image URLs only. */
  images: string[];
  priceFrom?: number;
  /** ISO currency code of `priceFrom` as returned by the provider. */
  priceCurrency?: string;
  distanceKm?: number;
}

export interface ProviderRoomOffer {
  id: string;
  roomId: string;
  roomName: string;
  description?: string;
  bedType?: string;
  view?: string;
  sizeSqm?: number;
  capacity?: number;
  amenities: string[];
  mealPlan?: string;
  cancellationPolicy?: string;
  images: string[];
  /** Per-night base rate in `currency`. */
  rate: number;
  currency: string;
  taxesAndFees?: number;
  totalPrice?: number;
  roomsAvailable: number;
  refundable?: boolean;
  /** Immersive media supplied by the provider, if any. */
  panoramaUrl?: string;
  modelUrl?: string;
}

export interface ProviderSearch {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  query?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  rooms?: number;
  currency?: string;
}

export interface HotelProvider {
  id: ProviderId;
  /** True when the provider is configured and reachable. */
  isLive(): boolean;
  searchHotels(params: ProviderSearch): Promise<ProviderHotel[]>;
  getRooms(params: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    rooms?: number;
    currency?: string;
  }): Promise<ProviderRoomOffer[]>;
}
