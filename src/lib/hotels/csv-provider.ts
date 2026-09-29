import type { HotelProvider, ProviderHotel, ProviderRoomOffer, ProviderSearch } from "@/lib/hotel-provider/types";
import { DatasetUnavailableError, isAvailableForStay, loadDataset, type CsvHotel } from "./csv-loader";

/**
 * Dataset provider — the default Aurelia inventory source
 * (HOTEL_PROVIDER=csv). Every value comes verbatim from
 * data/hotels_india_live_locations.csv: prices stay in ₹ INR exactly as
 * supplied; nothing is generated.
 */

function toProviderHotel(h: CsvHotel, distanceKm?: number): ProviderHotel {
  return {
    id: h.hotel_id,
    slug: h.hotel_id,
    name: h.name,
    city: h.city,
    country: h.state,
    address: h.address,
    latitude: h.latitude,
    longitude: h.longitude,
    rating: h.rating,
    description: `${h.room_type} room · ${h.rooms_available} room(s) available ${h.available_from} → ${h.available_to}`,
    amenities: [],
    images: [], // dataset supplies no imagery — cards show "image unavailable" honestly
    priceFrom: h.price_per_night_inr,
    priceCurrency: "INR",
    distanceKm,
  };
}

export async function getDatasetHotel(hotelId: string): Promise<CsvHotel | null> {
  return (await loadDataset()).hotels.find((h) => h.hotel_id === hotelId) ?? null;
}

/** Case-insensitive text match across name, city, state and address. */
function matchesQuery(h: CsvHotel, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    h.name.toLowerCase().includes(needle) ||
    h.city.toLowerCase().includes(needle) ||
    h.state.toLowerCase().includes(needle) ||
    h.address.toLowerCase().includes(needle)
  );
}

export const datasetProvider: HotelProvider = {
  id: "csv-dataset",

  isLive() {
    // Honest wording (§13): configured dataset, not a live market feed.
    return false;
  },

  async searchHotels(params: ProviderSearch): Promise<ProviderHotel[]> {
    let hotels = [...(await loadDataset()).hotels];

    if (params.query) hotels = hotels.filter((h) => matchesQuery(h, params.query!));
    if (params.latitude !== undefined && params.longitude !== undefined) {
      const { haversineKm } = await import("@/lib/geo");
      const from = { latitude: params.latitude, longitude: params.longitude };
      return hotels
        .map((h) => ({ h, km: haversineKm(from, { latitude: h.latitude, longitude: h.longitude }) }))
        .sort((a, b) => a.km - b.km)
        .filter(({ km }) => !params.radiusKm || km <= params.radiusKm)
        .map(({ h, km }) => toProviderHotel(h, km));
    }

    // date + rooms availability when booking filters are present
    if (params.checkIn && params.checkOut && /^\d{4}-\d{2}-\d{2}$/.test(params.checkIn)) {
      const rooms = params.rooms ?? 1;
      hotels = hotels.filter((h) =>
        isAvailableForStay(h, params.checkIn!, params.checkOut!, rooms)
      );
    }
    return hotels.map((h) => toProviderHotel(h));
  },

  async getRooms({ hotelId, checkIn, checkOut, rooms }): Promise<ProviderRoomOffer[]> {
    void checkIn;
    void checkOut;
    void rooms;
    const h = await getDatasetHotel(hotelId);
    if (!h) return [];
    return [
      {
        id: `dataset-${h.hotel_id}`,
        roomId: h.hotel_id,
        roomName: h.room_type,
        description: h.name,
        bedType: undefined, // not in the dataset — omitted rather than invented
        view: undefined,
        capacity: undefined,
        amenities: [],
        mealPlan: undefined,
        cancellationPolicy: undefined,
        images: [],
        rate: h.price_per_night_inr,
        currency: "INR",
        totalPrice: h.price_per_night_inr,
        roomsAvailable: h.rooms_available,
      },
    ];
  },
};

export { DatasetUnavailableError };
