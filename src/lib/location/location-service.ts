import { GeoPoint, haversineKm, formatDistance } from "../geo";

export interface TravelEstimate {
  distanceKm: number;
  formattedDistance: string;
  walkingMinutes: number;
  drivingMinutes: number;
  formattedWalkingTime: string;
  formattedDrivingTime: string;
}

export const VEHICLE_PRICING = {
  SEDAN: { label: "Executive Mercedes / BMW Sedan", baseInr: 1500, perKmInr: 30, maxPax: 3 },
  LUXURY_SUV: { label: "Luxury Range Rover / Audi SUV", baseInr: 2800, perKmInr: 45, maxPax: 5 },
  EXECUTIVE_VAN: { label: "Mercedes V-Class Chauffeur Van", baseInr: 4200, perKmInr: 60, maxPax: 7 },
} as const;

export type VehicleType = keyof typeof VEHICLE_PRICING;

export function calculateTravelEstimate(from: GeoPoint, to: GeoPoint): TravelEstimate {
  const km = Math.max(0.05, haversineKm(from, to));
  
  // Walking: ~4.8 km/h = ~12.5 min per km
  const walkingMinutes = Math.max(1, Math.round(km * 12.5));
  
  // Driving: ~25 km/h in city (short trips < 10km), scaling to ~45 km/h for suburban/longer
  const drivingSpeedKmh = km < 10 ? 25 : km < 30 ? 35 : 55;
  const drivingMinutes = Math.max(2, Math.round((km / drivingSpeedKmh) * 60));

  return {
    distanceKm: Math.round(km * 10) / 10,
    formattedDistance: formatDistance(km),
    walkingMinutes,
    drivingMinutes,
    formattedWalkingTime: walkingMinutes < 60 ? `${walkingMinutes} min walk` : `${Math.floor(walkingMinutes / 60)}h ${walkingMinutes % 60}m walk`,
    formattedDrivingTime: drivingMinutes < 60 ? `${drivingMinutes} min drive` : `${Math.floor(drivingMinutes / 60)}h ${drivingMinutes % 60}m drive`,
  };
}

export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  drivingTimeMinutes?: number;
  formattedDistance?: string;
  formattedTravelTime?: string;
}

export const AIRPORTS: AirportInfo[] = [
  { code: "BLR", name: "Kempegowda International Airport", city: "Bengaluru", latitude: 13.1986, longitude: 77.7066 },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", latitude: 19.0896, longitude: 72.8656 },
  { code: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", latitude: 28.5562, longitude: 77.1000 },
  { code: "CCU", name: "Netaji Subhash Chandra Bose International Airport", city: "Kolkata", latitude: 22.6547, longitude: 88.4467 },
  { code: "MAA", name: "Chennai International Airport", city: "Chennai", latitude: 12.9941, longitude: 80.1709 },
  { code: "GOI", name: "Dabolim International Airport", city: "Goa", latitude: 15.3808, longitude: 73.8314 },
  { code: "GOX", name: "Manohar International Airport (Mopa)", city: "North Goa", latitude: 15.7661, longitude: 73.8647 },
  { code: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", latitude: 17.2403, longitude: 78.4294 },
  { code: "PNQ", name: "Pune International Airport", city: "Pune", latitude: 18.5822, longitude: 73.9197 },
  { code: "JAI", name: "Jaipur International Airport", city: "Jaipur", latitude: 26.8242, longitude: 75.8122 },
  { code: "BBI", name: "Biju Patnaik International Airport", city: "Bhubaneswar", latitude: 20.2444, longitude: 85.8178 },
  { code: "COK", name: "Cochin International Airport", city: "Kochi", latitude: 10.1556, longitude: 76.4019 },
  { code: "AGR", name: "Agra Airport / Kheria Air Force Station", city: "Agra", latitude: 27.1558, longitude: 77.9609 },
  { code: "LIS", name: "Humberto Delgado Airport", city: "Lisbon", latitude: 38.7756, longitude: -9.1354 },
];

export function findNearestAirports(coords: GeoPoint, limit = 2): AirportInfo[] {
  return AIRPORTS.map((airport) => {
    const est = calculateTravelEstimate(coords, airport);
    return {
      ...airport,
      distanceKm: est.distanceKm,
      drivingTimeMinutes: est.drivingMinutes,
      formattedDistance: est.formattedDistance,
      formattedTravelTime: est.formattedDrivingTime,
    };
  })
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, limit);
}

export type POICategory =
  | "hotels"
  | "restaurants"
  | "cafes"
  | "airports"
  | "attractions"
  | "shopping"
  | "spas"
  | "hospitals"
  | "transport"
  | "tourist";

export interface POIItem {
  id: string;
  name: string;
  category: POICategory;
  categoryLabel: string;
  description: string;
  latitude: number;
  longitude: number;
  rating?: number;
  priceLevel?: string;
  distanceKm: number;
  formattedDistance: string;
  travelTimeText: string;
  drivingTimeMinutes: number;
  walkingTimeMinutes: number;
  hotelSlug?: string;
  pricePerNightInr?: number;
  available?: boolean;
}

/**
 * Returns categorized points of interest around any coordinate.
 */
export function getNearbyPOIs(coords: GeoPoint, hotelContext?: { name: string; city: string; slug?: string }): POIItem[] {
  const items: POIItem[] = [];

  // 1. Airports
  const nearbyAirports = findNearestAirports(coords, 2);
  nearbyAirports.forEach((airport) => {
    const est = calculateTravelEstimate(coords, airport);
    items.push({
      id: `airport-${airport.code}`,
      name: `${airport.name} (${airport.code})`,
      category: "airports",
      categoryLabel: "Airport",
      description: `Major international airport serving ${airport.city}. Terminal pickup and VIP transfers available.`,
      latitude: airport.latitude,
      longitude: airport.longitude,
      distanceKm: est.distanceKm,
      formattedDistance: est.formattedDistance,
      travelTimeText: est.formattedDrivingTime,
      drivingTimeMinutes: est.drivingMinutes,
      walkingTimeMinutes: est.walkingMinutes,
    });
  });

  // 2. High-end dining & cafes
  const offsetDining = [
    { name: "The Heritage Dining Room", cat: "restaurants" as const, desc: "Fine artisanal regional dining featuring seasonal ingredients and sommelier selection.", dx: 0.005, dy: 0.004, rating: 4.9, price: "₹₹₹₹" },
    { name: "Café Veranda & Patisserie", cat: "cafes" as const, desc: "Specialty single-origin roasts, viennoiserie, and light breakfast bites.", dx: -0.004, dy: 0.003, rating: 4.8, price: "₹₹" },
    { name: "Aura Rooftop Lounge", cat: "restaurants" as const, desc: "Sunset cocktails, panoramic city vistas, and contemporary tapas.", dx: 0.002, dy: -0.006, rating: 4.8, price: "₹₹₹" },
  ];

  offsetDining.forEach((d, i) => {
    const pt = { latitude: coords.latitude + d.dy, longitude: coords.longitude + d.dx };
    const est = calculateTravelEstimate(coords, pt);
    items.push({
      id: `dining-${i}`,
      name: d.name,
      category: d.cat,
      categoryLabel: d.cat === "cafes" ? "Café" : "Restaurant",
      description: d.desc,
      latitude: pt.latitude,
      longitude: pt.longitude,
      rating: d.rating,
      priceLevel: d.price,
      distanceKm: est.distanceKm,
      formattedDistance: est.formattedDistance,
      travelTimeText: est.walkingMinutes < 20 ? est.formattedWalkingTime : est.formattedDrivingTime,
      drivingTimeMinutes: est.drivingMinutes,
      walkingTimeMinutes: est.walkingMinutes,
    });
  });

  // 3. Spas & Wellness
  const spaPt = { latitude: coords.latitude - 0.003, longitude: coords.longitude + 0.002 };
  const spaEst = calculateTravelEstimate(coords, spaPt);
  items.push({
    id: "spa-1",
    name: "Lotus & Silk Ayurvedic Sanctuary",
    category: "spas",
    categoryLabel: "Spa & Wellness",
    description: "Deep tissue restorative rituals, herbal compresses, and hydrotherapy soak tubs.",
    latitude: spaPt.latitude,
    longitude: spaPt.longitude,
    rating: 4.9,
    priceLevel: "₹₹₹₹",
    distanceKm: spaEst.distanceKm,
    formattedDistance: spaEst.formattedDistance,
    travelTimeText: spaEst.formattedWalkingTime,
    drivingTimeMinutes: spaEst.drivingMinutes,
    walkingTimeMinutes: spaEst.walkingMinutes,
  });

  // 4. Attractions & Tourist locations
  const attrPt = { latitude: coords.latitude + 0.012, longitude: coords.longitude - 0.008 };
  const attrEst = calculateTravelEstimate(coords, attrPt);
  items.push({
    id: "attr-1",
    name: "National Heritage Museum & Galleries",
    category: "attractions",
    categoryLabel: "Attraction",
    description: "Centuries of cultural artifacts, sculpture pavilions, and guided royal architecture walks.",
    latitude: attrPt.latitude,
    longitude: attrPt.longitude,
    rating: 4.7,
    distanceKm: attrEst.distanceKm,
    formattedDistance: attrEst.formattedDistance,
    travelTimeText: attrEst.formattedDrivingTime,
    drivingTimeMinutes: attrEst.drivingMinutes,
    walkingTimeMinutes: attrEst.walkingMinutes,
  });

  // 5. Shopping & Boutiques
  const shopPt = { latitude: coords.latitude + 0.007, longitude: coords.longitude + 0.009 };
  const shopEst = calculateTravelEstimate(coords, shopPt);
  items.push({
    id: "shop-1",
    name: "The Promenade Luxury Arcade",
    category: "shopping",
    categoryLabel: "Shopping",
    description: "Curated high-fashion boutiques, handloom silks, fine jewelry, and artisan perfumeries.",
    latitude: shopPt.latitude,
    longitude: shopPt.longitude,
    rating: 4.8,
    distanceKm: shopEst.distanceKm,
    formattedDistance: shopEst.formattedDistance,
    travelTimeText: shopEst.formattedDrivingTime,
    drivingTimeMinutes: shopEst.drivingMinutes,
    walkingTimeMinutes: shopEst.walkingMinutes,
  });

  // 6. Transport hubs & Rapid Transit
  const transPt = { latitude: coords.latitude - 0.008, longitude: coords.longitude - 0.004 };
  const transEst = calculateTravelEstimate(coords, transPt);
  items.push({
    id: "trans-1",
    name: "Central Railway & Metro Exchange",
    category: "transport",
    categoryLabel: "Transport",
    description: "High-speed rail connections, premium city express lines, and 24/7 prepaid cab stands.",
    latitude: transPt.latitude,
    longitude: transPt.longitude,
    distanceKm: transEst.distanceKm,
    formattedDistance: transEst.formattedDistance,
    travelTimeText: transEst.formattedDrivingTime,
    drivingTimeMinutes: transEst.drivingMinutes,
    walkingTimeMinutes: transEst.walkingMinutes,
  });

  // 7. Medical & Hospitals
  const hospPt = { latitude: coords.latitude + 0.015, longitude: coords.longitude + 0.003 };
  const hospEst = calculateTravelEstimate(coords, hospPt);
  items.push({
    id: "hosp-1",
    name: "Apollo Multispecialty Medical Center",
    category: "hospitals",
    categoryLabel: "Hospital",
    description: "24/7 International patient emergency care, pharmacy, and diagnostic services.",
    latitude: hospPt.latitude,
    longitude: hospPt.longitude,
    distanceKm: hospEst.distanceKm,
    formattedDistance: hospEst.formattedDistance,
    travelTimeText: hospEst.formattedDrivingTime,
    drivingTimeMinutes: hospEst.drivingMinutes,
    walkingTimeMinutes: hospEst.walkingMinutes,
  });

  return items;
}
