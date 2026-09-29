/* Shared catalogs for the in-stay experience */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  section: string;
}

export const ROOM_SERVICE_MENU: MenuItem[] = [
  { id: "rs-grilled-seabass", name: "Grilled sea bass", description: "Fennel, lemon beurre blanc", price: 28, section: "Mains" },
  { id: "rs-club-sandwich", name: "Triple-decker club", description: "Free-range chicken, herb fries", price: 22, section: "Mains" },
  { id: "rs-mushroom-risotto", name: "Wild mushroom risotto", description: "Aged parmesan, truffle oil", price: 24, section: "Mains" },
  { id: "rs-caesar", name: "Little gem Caesar", description: "White anchovy, sourdough crumb", price: 16, section: "Smaller plates" },
  { id: "rs-charcuterie", name: "Charcuterie board", description: "Cured meats, pickles, grilled bread", price: 19, section: "Smaller plates" },
  { id: "rs-tiramisu", name: "Tiramisu al cucchiaio", description: "Espresso-soaked, mascarpone cloud", price: 12, section: "Sweet" },
  { id: "rs-cheesecake", name: "Basque cheesecake", description: "Burnt top, cherry compote", price: 11, section: "Sweet" },
  { id: "rs-wine", name: "House red, glass", description: "Sommelier's rotating pour", price: 9, section: "Drinks" },
  { id: "rs-negroni", name: "Negroni", description: "Stirred, orange coin", price: 14, section: "Drinks" },
  { id: "rs-sparkling", name: "Sparkling water, large", description: "Chilled, with citrus", price: 5, section: "Drinks" },
];

export const HOUSEKEEPING_REQUESTS = [
  { id: "hk-towels", label: "Fresh towels", detail: "Two bath, two hand" },
  { id: "hk-cleaning", label: "Refresh the room", detail: "Light clean, ~20 min" },
  { id: "hk-minibar", label: "Minibar restock", detail: "Replenish to standard" },
  { id: "hk-late", label: "Do not disturb until", detail: "Housekeeping after 15:00" },
] as const;

export const PILLOW_OPTIONS = [
  { id: "soft", label: "Soft & squishy" },
  { id: "firm", label: "Firm support" },
  { id: "memory", label: "Memory foam" },
  { id: "buckwheat", label: "Buckwheat hull" },
] as const;

export const ARRIVAL_TIMES = [
  "14:00 – 15:00",
  "15:00 – 17:00",
  "17:00 – 19:00",
  "19:00 – 21:00",
  "After 21:00",
] as const;

export function localRecsIntro(hour: number): { title: string; blurb: string } {
  if (hour < 11) return { title: "Morning, early riser", blurb: "Coffee and breakfast spots opening now — plus one for later." };
  if (hour < 15) return { title: "Midday wanderings", blurb: "Lunch within walking distance and an afternoon slow-down." };
  if (hour < 19) return { title: "Golden hour approaching", blurb: "Best light spots and a pre-dinner drink nearby." };
  return { title: "Tonight nearby", blurb: "Late bites and nightcap-worthy corners around you." };
}
