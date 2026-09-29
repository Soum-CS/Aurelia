import { haversineKm } from "@/lib/geo";
import { isAvailableForStay, loadDataset, type CsvHotel } from "./csv-loader";

export interface DatasetSearchParams {
  city?: string;
  state?: string;
  search?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  minRating?: number;
  maxPrice?: number;
  roomType?: string;
  sort?: "recommended" | "price_asc" | "price_desc" | "rating" | "reviews" | (string & {});
}

export type SearchOrder = "distance" | "recommended";

/**
 * The single Aurelia hotel-search pipeline over the configured dataset.
 * Filter order (§17): destination → name/search → state → dates → rooms →
 * rating → price → room type, then sorting.
 */
export async function searchDataset(params: DatasetSearchParams): Promise<Array<CsvHotel & { distanceKm?: number }>> {
  let hotels = [...(await loadDataset()).hotels];

  const city = params.city?.trim().toLowerCase();
  const state = params.state?.trim().toLowerCase();
  const search = params.search?.trim().toLowerCase();
  if (city) hotels = hotels.filter((h) => h.city.toLowerCase().includes(city));
  if (state) hotels = hotels.filter((h) => h.state.toLowerCase().includes(state));
  if (search)
    hotels = hotels.filter(
      (h) =>
        h.name.toLowerCase().includes(search) ||
        h.city.toLowerCase().includes(search) ||
        h.state.toLowerCase().includes(search) ||
        h.address.toLowerCase().includes(search)
    );

  let order: SearchOrder = "recommended";
  if (params.latitude !== undefined && params.longitude !== undefined) {
    const from = { latitude: params.latitude, longitude: params.longitude };
    order = "distance";
    hotels = hotels
      .map((h) => ({ h, km: haversineKm(from, { latitude: h.latitude, longitude: h.longitude }) }))
      .sort((a, b) => a.km - b.km)
      .filter(({ km }) => !params.radiusKm || km <= params.radiusKm)
      .map(({ h, km }) => ({ ...h, distanceKm: Math.round(km * 10) / 10 }));
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(params.checkIn ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(params.checkOut ?? "")) {
    hotels = hotels.filter((h) => isAvailableForStay(h, params.checkIn!, params.checkOut!, params.rooms ?? 1));
  } else {
    hotels = hotels.filter((h) => h.rooms_available > 0);
  }

  if (params.minRating !== undefined) hotels = hotels.filter((h) => h.rating >= params.minRating!);
  if (params.maxPrice !== undefined) hotels = hotels.filter((h) => h.price_per_night_inr <= params.maxPrice!);
  if (params.roomType) hotels = hotels.filter((h) => h.room_type.toLowerCase() === params.roomType!.toLowerCase());

  if (order !== "distance") {
    switch (params.sort) {
      case "price_asc": hotels.sort((a, b) => a.price_per_night_inr - b.price_per_night_inr); break;
      case "price_desc": hotels.sort((a, b) => b.price_per_night_inr - a.price_per_night_inr); break;
      case "rating": hotels.sort((a, b) => b.rating - a.rating); break;
      case "reviews": hotels.sort((a, b) => b.rating_count - a.rating_count); break;
      default: hotels.sort((a, b) => b.rating - a.rating);
    }
  }
  return hotels;
}
