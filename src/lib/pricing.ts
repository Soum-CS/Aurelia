import { Addon, ParsedBookingAddon } from "./types";

export const TAX_RATE = 0.12;
export const SERVICE_FEE_PER_NIGHT = 12;

export const ADDONS: Addon[] = [
  {
    id: "breakfast",
    label: "Artisanal Chef's Breakfast",
    description: "Daily gourmet breakfast à la carte or in-room dining for each guest",
    price: 24,
    perNight: true,
    perGuest: true,
  },
  {
    id: "pickup",
    label: "VIP Airport Pickup",
    description: "Chauffeur meet & greet at arrivals with executive luxury sedan",
    price: 65,
  },
  {
    id: "drop",
    label: "VIP Airport Drop-off",
    description: "Scheduled transfer directly to departures terminal with luggage assistance",
    price: 60,
  },
  {
    id: "spa",
    label: "Revitalizing Spa Package",
    description: "60-minute signature aromatherapy massage & steam therapy session",
    price: 85,
  },
  {
    id: "romantic-setup",
    label: "Romantic Turndown Setup",
    description: "Fresh rose petals, scented beeswax candles, and chilled vintage champagne",
    price: 55,
  },
  {
    id: "extra-bed",
    label: "Plush Extra Bed",
    description: "Premium rollaway featherbed with Italian cotton linens",
    price: 45,
    perNight: true,
  },
  {
    id: "early-checkin",
    label: "Guaranteed Early Check-in",
    description: "Access your room starting at 10:00 AM on arrival day",
    price: 35,
  },
  {
    id: "late-checkout",
    label: "Extended Late Checkout",
    description: "Keep your suite until 4:00 PM on departure day",
    price: 40,
  },
  {
    id: "laundry",
    label: "Express Garment Laundry & Pressing",
    description: "Same-day eco-friendly laundering and steam pressing for up to 6 garments",
    price: 30,
  },
  {
    id: "room-service",
    label: "24/7 Unlimited In-Room Dining Service",
    description: "Zero delivery surcharge across entire stay for all kitchen orders",
    price: 25,
    perNight: true,
  },
  {
    id: "candlelight-dinner",
    label: "Private Candlelight Chef's Dinner",
    description: "5-course bespoke terrace dining under the stars with sommelier wine pairing",
    price: 140,
  },
  {
    id: "city-tour",
    label: "Curated Private City Tour",
    description: "4-hour guided cultural expedition in private luxury vehicle",
    price: 95,
  },
  {
    id: "premium-minibar",
    label: "Replenished Premium Minibar Package",
    description: "Organic snacks, single malts, botanical sodas, and imported chocolates",
    price: 50,
  },
  {
    id: "workspace-package",
    label: "Executive Workspace Package",
    description: "Ergonomic leather desk blotter, 4K display dock, wireless charging, and silent printing",
    price: 28,
  },
  {
    id: "prosecco",
    label: "Welcome Chilled Prosecco & Berries",
    description: "A bottle and seasonal fresh berries waiting in your room upon arrival",
    price: 30,
  },
];

export function addonAmount(
  addon: Addon,
  nights: number,
  guests: number
): number {
  let amount = addon.price;
  if (addon.perNight) amount *= nights;
  if (addon.perGuest) amount *= guests;
  return amount;
}

export interface PriceQuote {
  rate: number;
  nights: number;
  roomsSubtotal: number;
  addons: ParsedBookingAddon[];
  addonsTotal: number;
  serviceFee: number;
  taxesFees: number;
  total: number;
}

export function quotePrice(
  basePrice: number,
  nights: number,
  guests: number,
  selectedAddonIds: string[]
): PriceQuote {
  const roomsSubtotal = basePrice * Math.max(nights, 0);
  const addons: ParsedBookingAddon[] = [];
  for (const id of selectedAddonIds) {
    const addon = ADDONS.find((a) => a.id === id);
    if (!addon) continue;
    addons.push({
      id: addon.id,
      label: addon.label,
      amount: addonAmount(addon, Math.max(nights, 1), guests),
    });
  }
  const addonsTotal = addons.reduce((sum, a) => sum + a.amount, 0);
  const serviceFee = SERVICE_FEE_PER_NIGHT * Math.max(nights, 0);
  const subtotal = roomsSubtotal + addonsTotal + serviceFee;
  const taxesFees = Math.round(subtotal * TAX_RATE * 100) / 100;
  return {
    rate: basePrice,
    nights,
    roomsSubtotal,
    addons,
    addonsTotal,
    serviceFee,
    taxesFees,
    total: subtotal + taxesFees,
  };
}
