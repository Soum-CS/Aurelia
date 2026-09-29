import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FaqItem {
  q: string;
  a: string;
}

interface SeedRoom {
  name: string;
  description: string;
  basePrice: number;
  capacity: number;
  sizeSqm: number;
  bedType: string;
  view: string;
  amenities: string[];
  accessibilityFeatures: string[];
  scene: object;
  unitsAvailable: number;
}

interface SeedHotel {
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
  faq: FaqItem[];
  localTips: string[];
  weather: { tempC: number; condition: string; packing: string };
  artSeed: number;
  featured: boolean;
  rooms: SeedRoom[];
}

const ROOM_AMENITIES = [
  "Rain shower",
  "Nespresso machine",
  "Smart TV",
  "Blackout drapes",
  "Climate control",
  "In-room safe",
];

const hotels: SeedHotel[] = [
  {
    slug: "the-meridian-lisbon",
    name: "The Meridian",
    city: "Lisbon",
    country: "Portugal",
    address: "Rua do Comércio 142, Baixa",
    latitude: 38.7078,
    longitude: -9.1366,
    tagline: "Baixa grandeur, reimagined for the slow traveler",
    description:
      "A restored 1920s banking hall in the heart of Baixa, where vaulted ceilings meet calçada stone and afternoon light pours across brass fixtures. Rooftop pool, a wine cellar bar, and tram bells below your window.",
    rating: 4.8,
    reviewCount: 412,
    amenities: [
      "Rooftop pool",
      "Wine cellar bar",
      "24h concierge",
      "Spa & hammam",
      "Free WiFi",
      "Airport transfer",
    ],
    faq: [
      { q: "What are the rooftop pool hours?", a: "The rooftop pool is open 08:00–20:00 daily, with towel service on the lounge deck." },
      { q: "Is breakfast included and when is it served?", a: "Breakfast is served in the Atrium Hall 07:00–10:30 on weekdays and until 11:30 on weekends." },
      { q: "What's the WiFi password?", a: `Connect to “Meridian-Guest” — the password is “lisbon1927”.` },
      { q: "Can I park at the hotel?", a: "We offer valet parking at €28/night; the nearest garage is 200 m away on Rua da Prata." },
      { q: "Are pets allowed?", a: "Small pets under 10 kg are welcome for a €30/night fee, beds and bowls included." },
      { q: "How late can I check out?", a: "Standard checkout is 11:00. Late checkout until 15:00 can be added to your folio for €40." },
      { q: "Where is the gym?", a: "The fitness studio is on level −1, open 24 hours with your room key." },
    ],
    localTips: [
      "Time Out Market Lisboa — 8 min walk, go before noon to beat queues",
      "Tram 28 through Alfama — board at Praça Luís de Camões early morning",
      "Sunset miradouro: São Pedro de Alcântara, 12 min by taxi",
      "Fado night at Mesa de Frades — Tuesdays & Saturdays",
    ],
    weather: { tempC: 24, condition: "Sunny with an Atlantic breeze", packing: "Light layers, sunglasses, and comfortable cobblestone-proof shoes." },
    artSeed: 11,
    featured: true,
    rooms: [
      {
        name: "City King",
        description:
          "A serene king room above the tiled rooftops of Baixa, with a writing desk set beneath the original shuttered window.",
        basePrice: 240,
        capacity: 2,
        sizeSqm: 32,
        bedType: "King bed",
        view: "City rooftops",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: ["Step-free entry", "Grab bars in bathroom"],
        scene: { palette: "sand", windowView: "city", bed: "king", extras: ["desk"] },
        unitsAvailable: 6,
      },
      {
        name: "Corner Suite",
        description:
          "Wraparound windows on two exposures, a separate lounge, and a freestanding tub facing the Tagus.",
        basePrice: 390,
        capacity: 3,
        sizeSqm: 48,
        bedType: "King bed",
        view: "Tagus River",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: [],
        scene: {
          palette: "terracotta",
          windowView: "city",
          bed: "king",
          extras: ["sofa", "desk", "bathtub"],
        },
        unitsAvailable: 3,
      },
    ],
  },
  {
    slug: "casa-solera",
    name: "Casa Solera",
    city: "Seville",
    country: "Spain",
    address: "Calle Ximénez de Enciso 22, Santa Cruz",
    latitude: 37.3861,
    longitude: -5.9894,
    tagline: "A courtyard house perfumed by orange blossom",
    description:
      "Behind an unassuming door in Santa Cruz lies a 17th-century casa patio: hand-painted azulejos, a fountain courtyard, and rooms that open onto jasmine-covered galleries.",
    rating: 4.7,
    reviewCount: 298,
    amenities: [
      "Courtyard plunge pool",
      "Tapas kitchen",
      "Flamenco nights",
      "Free WiFi",
      "Bicycle hire",
      "Concierge",
    ],
    faq: [
      { q: "When is the courtyard pool open?", a: "The plunge pool is refreshed daily and open 09:00–21:00, April through October." },
      { q: "What's the WiFi password?", a: `Network “CasaSolera”, password “azahar1662”.` },
      { q: "Is breakfast served?", a: "Continental breakfast with local pastries runs 08:00–11:00 under the orange trees." },
      { q: "Do you have parking?", a: "Santa Cruz is pedestrianised — we recommend the Cano y Cueto garage, 400 m away (€22/day)." },
      { q: "Are pets allowed?", a: "Well-behaved pets are welcome on request; the courtyard is theirs to enjoy." },
      { q: "What time is checkout?", a: "Checkout is at 11:00; late checkout until 14:00 is €35 subject to availability." },
      { q: "Is there a gym?", a: "No gym on site, but our bicycle hire is free for guests and Seville's riverside loop is flat and gorgeous." },
    ],
    localTips: [
      "Real Alcázar — book the 09:00 slot, 6 min walk",
      "Tapas crawl: Bar Eslava → Las Golondrinas → Casa Morales",
      "Flamenco museum courtyard show at 19:00",
      "Plaza de España at golden hour, rent a rowboat",
    ],
    weather: { tempC: 33, condition: "Dry Andalusian heat, cooler evenings", packing: "Breathable fabrics, a hat, and a light layer for late tapas nights." },
    artSeed: 27,
    featured: false,
    rooms: [
      {
        name: "Patio Queen",
        description:
          "Opens directly onto the fountain courtyard — shuttered mornings, golden by five.",
        basePrice: 185,
        capacity: 2,
        sizeSqm: 28,
        bedType: "Queen bed",
        view: "Courtyard garden",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: ["Step-free entry"],
        scene: { palette: "sand", windowView: "garden", bed: "queen", extras: ["desk"] },
        unitsAvailable: 5,
      },
      {
        name: "Azahar Loft",
        description:
          "Top-floor loft under old chestnut beams with a private terrace among the orange trees.",
        basePrice: 310,
        capacity: 3,
        sizeSqm: 44,
        bedType: "Queen bed + daybed",
        view: "Orange grove terrace",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: [],
        scene: {
          palette: "terracotta",
          windowView: "garden",
          bed: "queen",
          extras: ["sofa", "bathtub"],
        },
        unitsAvailable: 2,
      },
    ],
  },
  {
    slug: "azure-bay-santorini",
    name: "Azure Bay Resort",
    city: "Oia",
    country: "Greece",
    address: "Caldera Cliff Path, Oia 847 02",
    latitude: 36.4618,
    longitude: 25.3753,
    tagline: "Carved into the caldera, facing forever",
    description:
      "Whitewashed suites stepped down the cliffside of Oia, each with a terrace over the Aegean. Sunset here is an event; breakfast arrives by dumbwaiter to your own pergola.",
    rating: 4.9,
    reviewCount: 521,
    amenities: [
      "Cliffside infinity pool",
      "Private terraces",
      "Sunset dining",
      "Spa cave",
      "Free WiFi",
      "Catamaran trips",
    ],
    faq: [
      { q: "Where can I watch the sunset?", a: "From your terrace, honestly. The resort also reserves the west deck 30 min before sunset each evening." },
      { q: "What are the infinity pool hours?", a: "07:30–sunset, heated in shoulder season." },
      { q: "What's the WiFi password?", a: `Network “AzureBay”, password “caldera2024”.` },
      { q: "How do I get there from the airport?", a: "JTR is 25 min away; our private transfer is €65 each way — add it any time before arrival." },
      { q: "Is breakfast included?", a: "It can be — the pergola breakfast is €24/guest/day and comes up by dumbwaiter at your chosen hour." },
      { q: "Can you arrange boat trips?", a: "Yes — catamaran caldera cruises depart daily at 10:30; the concierge handles bookings." },
      { q: "What about the steps?", a: "Oia is stepped. We offer porter service for luggage and a cliff-lift from the drop-off point." },
      { q: "Checkout time?", a: "11:00, though sunset-lovers often add late checkout until 18:00 (€90) for one last swim." },
    ],
    localTips: [
      "Swim at Ammoudi Bay below the red cliffs — 180 steps down, worth it",
      "Byzantine castle ruins for the classic Oia panorama (arrive 90 min pre-sunset)",
      "Sigalas winery for assyrtiko tasting, 15 min drive",
      "Night kayak under full moon — book at reception",
    ],
    weather: { tempC: 27, condition: "Aegean sun, meltemi breeze", packing: "Swimsuits, reef-safe sunscreen, and a windbreaker for boat days." },
    artSeed: 42,
    featured: true,
    rooms: [
      {
        name: "Aegean King",
        description:
          "Curved whitewash walls, a built-in king, and a window framing nothing but blue.",
        basePrice: 320,
        capacity: 2,
        sizeSqm: 34,
        bedType: "King bed",
        view: "Aegean Sea",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: [],
        scene: { palette: "azure", windowView: "ocean", bed: "king", extras: ["desk"] },
        unitsAvailable: 8,
      },
      {
        name: "Cliffside Suite",
        description:
          "Two levels above the water with a plunge pool, sun lounges, and a tub carved into the caldera rock.",
        basePrice: 540,
        capacity: 4,
        sizeSqm: 62,
        bedType: "King bed + sofa bed",
        view: "Caldera & sunset",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: ["Cliff-lift access", "Roll-in shower"],
        scene: {
          palette: "azure",
          windowView: "ocean",
          bed: "king",
          extras: ["sofa", "lounge", "bathtub"],
        },
        unitsAvailable: 4,
      },
    ],
  },
  {
    slug: "foglark-lodge",
    name: "The Foglark Lodge",
    city: "Zermatt",
    country: "Switzerland",
    address: "Winkelmattenweg 18, 3920 Zermatt",
    latitude: 46.0207,
    longitude: 7.7491,
    tagline: "Timber, firelight, and the Matterhorn at breakfast",
    description:
      "A century-old larchwood lodge at 1,600 metres. Rooms smell of pine and woodsmoke; the spa's outdoor pool steams under the stars.",
    rating: 4.8,
    reviewCount: 187,
    amenities: [
      "Alpine spa & sauna",
      "Fondue stube",
      "Ski-in access",
      "Fireplace lounge",
      "Free WiFi",
      "Boot room service",
    ],
    faq: [
      { q: "What are the spa hours?", a: "The alpine spa (sauna, steam, outdoor pool) runs 14:00–21:00 daily; swimsuits are optional in the sauna area." },
      { q: "What's the WiFi password?", a: `Network “Foglark”, password “matterhorn1865”.` },
      { q: "Is dinner available?", a: "The fondue stube serves 18:00–22:00; reserve at breakfast or via the concierge chat." },
      { q: "How does ski storage work?", a: "The boot room has heated dryers — leave skis overnight and they'll be waiting by the ski-in door." },
      { q: "Do you have parking?", a: "Zermatt is car-free. Park at Täsch terminal and take the shuttle train (12 min); we collect you from the station." },
      { q: "Pets?", a: "Dogs are family here — CHF 25/night with a bowl and blanket at turndown." },
      { q: "Checkout time?", a: "11:00. Ski-day late checkout until 17:00 with shower access afterwards can be arranged (CHF 60)." },
      { q: "Gym?", a: "There's a small fitness alcove by the spa, open 07:00–21:00." },
    ],
    localTips: [
      "Sunnegga funicular for the easiest Matterhorn viewpoint",
      "Fondue at Findlerhof — hike in via Furi, book ahead",
      "Gornergrat railway at first light, before the crowds",
      "Apres-ski: Hennu Stall at Sunnegga base",
    ],
    weather: { tempC: 4, condition: "Alpine sun with fresh powder up top", packing: "Thermal layers, waterproof boots, SPF — mountain sun is strong." },
    artSeed: 73,
    featured: false,
    rooms: [
      {
        name: "Timber King",
        description:
          "Solid larch walls, a deep window seat, and your own wood stove already lit at turndown.",
        basePrice: 275,
        capacity: 2,
        sizeSqm: 36,
        bedType: "King bed",
        view: "Matterhorn",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: ["Step-free entry", "Grab bars in bathroom"],
        scene: {
          palette: "forest",
          windowView: "alps",
          bed: "king",
          extras: ["fireplace", "desk"],
        },
        unitsAvailable: 5,
      },
      {
        name: "Panorama Suite",
        description:
          "Glass gable end over the valley, a reading lounge, and a copper tub positioned for the peak.",
        basePrice: 480,
        capacity: 4,
        sizeSqm: 58,
        bedType: "King bed + sofa bed",
        view: "Glacier panorama",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: [],
        scene: {
          palette: "forest",
          windowView: "alps",
          bed: "king",
          extras: ["sofa", "fireplace", "bathtub"],
        },
        unitsAvailable: 3,
      },
    ],
  },
  {
    slug: "noir-on-fifth",
    name: "Noir on Fifth",
    city: "New York",
    country: "United States",
    address: "512 Fifth Avenue, Midtown Manhattan",
    latitude: 40.7547,
    longitude: -73.9818,
    tagline: "Midtown's quietest address, one floor above the noise",
    description:
      "A dark, cinematic tower hotel overlooking Fifth Avenue. Smoked glass, walnut fluting, jazz in the lobby bar — and some of the best skyline views in Manhattan.",
    rating: 4.6,
    reviewCount: 633,
    amenities: [
      "Skyline bar",
      "24h gym",
      "Jazz lounge",
      "Express spa",
      "Free WiFi",
      "Valet parking",
    ],
    faq: [
      { q: "What time does the jazz lounge start?", a: "Sets run 19:00–23:00 Thursday through Saturday in the lobby bar; no cover for guests." },
      { q: "What's the WiFi password?", a: `Network “Noir5th-Guest”, password “fifthave1931”.` },
      { q: "Is the gym really 24 hours?", a: "Yes — level 3, keycard access, towels provided." },
      { q: "Parking?", a: "Valet only, $75/night with in-and-out privileges." },
      { q: "Breakfast?", a: "The Fifth Floor diner serves 06:30–11:00; the espresso bar opens at 06:00." },
      { q: "Pets allowed?", a: "Cats and dogs up to 25 lbs, $100/night deposit refunded at checkout." },
      { q: "Late checkout?", a: "Until 14:00 for $60 on weekdays — ask the concierge the night before." },
    ],
    localTips: [
      "Bryant Park reading room, 10 min walk",
      "Grand Central whispering gallery — stand face-to-face at the corners",
      "Koreatown BBQ till late on 32nd St",
      "Top of the Rock at blue hour beats the Empire State queues",
    ],
    weather: { tempC: 12, condition: "Crisp fall air, chance of quick showers", packing: "A warm jacket, compact umbrella, and shoes built for blocks of walking." },
    artSeed: 96,
    featured: true,
    rooms: [
      {
        name: "Skyline King",
        description:
          "Floor-to-ceiling glass over Fifth Avenue, a walnut desk, and blackout everything.",
        basePrice: 420,
        capacity: 2,
        sizeSqm: 33,
        bedType: "King bed",
        view: "Fifth Avenue skyline",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: ["Step-free entry", "Roll-in shower", "Visual fire alarm"],
        scene: { palette: "noir", windowView: "city", bed: "king", extras: ["desk"] },
        unitsAvailable: 7,
      },
      {
        name: "Duplex Loft",
        description:
          "A two-level suite with spiral stair, piano lounge, and a bathtub set against the city glow.",
        basePrice: 760,
        capacity: 4,
        sizeSqm: 75,
        bedType: "King bed + sofa beds",
        view: "Manhattan panorama",
        amenities: ROOM_AMENITIES,
        accessibilityFeatures: [],
        scene: {
          palette: "noir",
          windowView: "city",
          bed: "king",
          extras: ["sofa", "lounge", "desk", "bathtub"],
        },
        unitsAvailable: 2,
      },
    ],
  },
];

async function main() {
  await prisma.invoice.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.experienceBooking.deleteMany();
  await prisma.foodOrderItem.deleteMany();
  await prisma.foodOrder.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.review.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.user.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.hotel.deleteMany();

  for (const h of hotels) {
    const hotel = await prisma.hotel.create({
      data: {
        slug: h.slug,
        name: h.name,
        city: h.city,
        country: h.country,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        tagline: h.tagline,
        description: h.description,
        rating: h.rating,
        reviewCount: h.reviewCount,
        amenities: JSON.stringify(h.amenities),
        faq: JSON.stringify(h.faq),
        localTips: JSON.stringify(h.localTips),
        weather: JSON.stringify(h.weather),
        artSeed: h.artSeed,
        featured: h.featured,
      },
    });
  for (const r of h.rooms) {
    await prisma.roomType.create({
      data: {
        hotelId: hotel.id,
        name: r.name,
        description: r.description,
        basePrice: r.basePrice,
        capacity: r.capacity,
        sizeSqm: r.sizeSqm,
        bedType: r.bedType,
        view: r.view,
        amenities: JSON.stringify(r.amenities),
        accessibilityFeatures: JSON.stringify(r.accessibilityFeatures),
        scene: JSON.stringify(r.scene),
        unitsAvailable: r.unitsAvailable,
      },
    });
  }
  await seedDiningAndExperiences(hotel.id, h.slug);
  }
  console.log(`Seeded ${hotels.length} hotels with dining + experiences.`);
}

/* ── Hotel dining & local experiences (demo provenance, labeled in UI) ── */

interface SeedItem {
  n: string; // name
  d: string; // description
  p: number; // priceInr
  diet?: "VEG" | "NON_VEG" | "VEGAN" | "EGG";
  cal?: number;
  allergens?: string[];
  ing?: string;
  prep?: number;
  spice?: number;
  protein?: number;
  tags?: string[];
  addons?: { name: string; priceInr: number }[];
  emoji?: string;
  avail?: boolean;
}

interface SeedCategory {
  name: string;
  items: SeedItem[];
}

interface SeedRestaurant {
  name: string;
  cuisine: string;
  summary: string;
  hours: { breakfast: string; lunch: string; dinner: string };
}

function item(i: SeedItem) {
  return {
    name: i.n,
    description: i.d,
    priceInr: i.p,
    diet: i.diet ?? "VEG",
    calories: i.cal ?? null,
    allergens: JSON.stringify(i.allergens ?? []),
    ingredients: i.ing ?? null,
    prepMinutes: i.prep ?? 20,
    spiceLevel: i.spice ?? 0,
    proteinG: i.protein ?? null,
    tags: JSON.stringify(i.tags ?? []),
    addons: JSON.stringify(i.addons ?? []),
    imageEmoji: i.emoji ?? "🍽️",
    available: i.avail ?? true,
  };
}

const SHARED_ADDONS = {
  extraRotti: { name: "Extra butter roti", priceInr: 60 },
  extraRice: { name: "Extra steamed rice", priceInr: 90 },
  cheese: { name: "Add cheese", priceInr: 50 },
};

function diningCatalog(slug: string): { restaurant: SeedRestaurant; categories: SeedCategory[] } {
  const common: SeedCategory[] = [
    {
      name: "Breakfast",
      items: [
        { n: "Masala Dosa", d: "Crisp rice crêpe, spiced potato, coconut chutney", p: 220, cal: 320, prep: 15, tags: ["breakfast", "jain"], emoji: "🥞" },
        { n: "Poha Bowl", d: "Flattened rice, curry leaves, peanuts, lime", p: 160, cal: 280, prep: 10, tags: ["breakfast", "healthy"], emoji: "🍚" },
        { n: "Avocado Sourdough Toast", d: "Smashed avocado, chilli flakes, dukkah", p: 340, cal: 380, diet: "VEGAN", allergens: ["gluten", "nuts"], prep: 12, protein: 9, tags: ["breakfast", "healthy"], emoji: "🥑" },
        { n: "Eggs Benedict", d: "Poached eggs, hollandaise, smoked ham on muffin", p: 390, cal: 520, diet: "EGG", allergens: ["egg", "gluten", "dairy"], prep: 18, protein: 24, tags: ["breakfast"], emoji: "🍳" },
        { n: "Idli Sambar (4 pc)", d: "Steamed rice cakes, lentil sambar, chutneys", p: 180, cal: 260, prep: 12, tags: ["breakfast", "healthy", "jain-available"], emoji: "🍥" },
      ],
    },
    {
      name: "Beverages",
      items: [
        { n: "Single-Origin Filter Coffee", d: "Slow-brewed, chicory-free", p: 120, cal: 5, prep: 6, tags: ["drinks", "breakfast"], emoji: "☕" },
        { n: "Masala Chai", d: "Assam leaf tea, ginger, cardamom", p: 90, cal: 60, prep: 8, tags: ["drinks"], emoji: "🫖" },
        { n: "Cold-Pressed Green Juice", d: "Spinach, cucumber, apple, ginger", p: 210, cal: 110, prep: 7, tags: ["drinks", "healthy", "low-cal"], diet: "VEGAN", emoji: "🥤" },
        { n: "Fresh Lime Soda", d: "Sweet, salted or mixed", p: 100, cal: 80, prep: 4, tags: ["drinks"], emoji: "🍹" },
      ],
    },
    {
      name: "Kids",
      items: [
        { n: "Mini Margherita Pizza", d: "Hand-stretched dough, fior di latte", p: 260, cal: 450, allergens: ["gluten", "dairy"], prep: 16, tags: ["kids"], emoji: "🍕" },
        { n: "Mac & Cheese Cup", d: "Elbow pasta, three-cheese sauce", p: 240, cal: 480, allergens: ["gluten", "dairy"], prep: 14, protein: 16, tags: ["kids"], emoji: "🧀" },
        { n: "Banana Pancake Stack", d: "Two stacks, honey drizzle, no nuts", p: 200, cal: 390, allergens: ["gluten", "egg"], prep: 12, tags: ["kids", "breakfast"], emoji: "🥞" },
      ],
    },
    {
      name: "Desserts",
      items: [
        { n: "Gulab Jamun (2 pc)", d: "Warm milk dumplings, saffron syrup", p: 150, cal: 300, allergens: ["dairy", "nuts"], prep: 5, emoji: "🍮" },
        { n: "Dark Chocolate Fondant", d: "70% single-origin, molten centre", p: 290, cal: 420, allergens: ["dairy", "egg", "gluten"], prep: 15, emoji: "🍫" },
        { n: "Seasonal Fruit Shrikhand", d: "Hung curd, mango, pistachio dust", p: 180, cal: 240, allergens: ["dairy", "nuts"], prep: 6, tags: ["healthy"], emoji: "🍨" },
      ],
    },
  ];

  const perHotel: Record<string, Partial<SeedRestaurant> & { categories: SeedCategory[] }> = {
    "the-meridian-lisbon": {
      name: "Atrium Hall",
      cuisine: "Continental · Indian",
      summary: "Vaulted-ceiling all-day dining off the lobby; tram-view terrace.",
      categories: [
        {
          name: "Starters",
          items: [
            { n: "Paneer Tikka Skewers", d: "Charcoal-kissed cottage cheese, mint chutney", p: 320, cal: 310, spice: 2, protein: 18, prep: 18, tags: ["high-protein", "grill"], emoji: "🧆" },
            { n: "Pastéis de Bacalhau", d: "Salt-cod croquettes, lemon aioli", p: 380, cal: 350, diet: "NON_VEG", allergens: ["fish", "egg"], prep: 14, emoji: "🐟" },
            { n: "Tomato & Burrata Salad", d: "Heirloom tomatoes, basil oil", p: 360, cal: 280, allergens: ["dairy"], prep: 10, tags: ["healthy", "low-cal"], emoji: "🥗" },
          ],
        },
        {
          name: "Main Course",
          items: [
            { n: "Chicken Biryani", d: "Spicy aromatic basmati layered with chicken and traditional spices", p: 420, cal: 640, diet: "NON_VEG", spice: 2, protein: 32, prep: 25, tags: ["spicy", "high-protein", "chef-special"], addons: [SHARED_ADDONS.extraRice], emoji: "🍛" },
            { n: "Wild Mushroom Risotto", d: "Aged parmesan, truffle oil", p: 520, cal: 560, allergens: ["dairy"], prep: 26, emoji: "🍲" },
            { n: "Grilled Sea Bass", d: "Fennel, lemon beurre blanc", p: 640, cal: 430, diet: "NON_VEG", allergens: ["fish", "dairy"], prep: 24, protein: 38, tags: ["high-protein"], emoji: "🐠" },
            { n: "Dal Makhani + Roti", d: "Overnight black lentils, buttered rotis", p: 280, cal: 420, allergens: ["dairy"], prep: 20, protein: 16, tags: ["healthy"], addons: [SHARED_ADDONS.extraRotti], emoji: "🥘" },
          ],
        },
      ],
    },
    "casa-solera": {
      name: "Patio de la Aceituna",
      cuisine: "Andalusian · Indian",
      summary: "Orange-tree courtyard dining; tapas until late.",
      categories: [
        {
          name: "Starters",
          items: [
            { n: "Gazpacho Andaluz", d: "Chilled tomato, pepper, sherry vinegar", p: 260, cal: 150, diet: "VEGAN", prep: 8, tags: ["healthy", "low-cal"], emoji: "🍅" },
            { n: "Tandoori Wrap", d: "Clay-oven chicken, pickled onion, mint raita", p: 350, cal: 480, diet: "NON_VEG", spice: 2, protein: 27, prep: 18, tags: ["spicy", "high-protein"], emoji: "🌮" },
          ],
        },
        {
          name: "Main Course",
          items: [
            { n: "Schezwan Noodles", d: "Wok-tossed, house schezwan, crunchy veg", p: 390, cal: 520, spice: 3, prep: 20, tags: ["spicy"], emoji: "🍜" },
            { n: "Vegetable Paella", d: "Bomba rice, saffron, charred artichoke", p: 480, cal: 500, prep: 28, diet: "VEGAN", emoji: "🥘" },
            { n: "Lamb Kofta Curry", d: "Slow-cooked meatballs, cashew gravy", p: 560, cal: 610, diet: "NON_VEG", allergens: ["nuts"], spice: 2, protein: 30, prep: 30, tags: ["high-protein"], emoji: "🍖" },
          ],
        },
      ],
    },
    "azure-bay-santorini": {
      name: "Azure Terrace Grill",
      cuisine: "Mediterranean · Indian",
      summary: "Caldera-edge grill; sunset seating recommended.",
      categories: [
        {
          name: "Healthy",
          items: [
            { n: "Paneer Salad", d: "Grilled paneer, watercress, pomegranate, feta", p: 320, cal: 260, allergens: ["dairy"], protein: 19, prep: 12, tags: ["healthy", "low-cal", "high-protein"], emoji: "🥗" },
            { n: "Veg Soup of the Day", d: "Slow-simmered seasonal vegetables", p: 220, cal: 140, prep: 10, tags: ["healthy", "low-cal"], diet: "VEGAN", emoji: "🍲" },
            { n: "Grilled Halloumi Bowl", d: "Freekeh, herbs, lemon oil", p: 380, cal: 330, allergens: ["dairy", "gluten"], protein: 17, prep: 16, tags: ["healthy", "high-protein"], emoji: "🥙" },
          ],
        },
        {
          name: "Main Course",
          items: [
            { n: "Catch of the Day", d: "Aegean fish, capers, olive oil crushed potatoes", p: 720, cal: 420, diet: "NON_VEG", allergens: ["fish"], protein: 41, prep: 25, tags: ["high-protein", "chef-special"], emoji: "🐡" },
            { n: "Palak Paneer + Naan", d: "Silken spinach, garlic naan", p: 340, cal: 450, allergens: ["dairy", "gluten"], protein: 21, prep: 22, tags: ["high-protein"], addons: [SHARED_ADDONS.extraRotti], emoji: "🥬" },
          ],
        },
      ],
    },
    "foglark-lodge": {
      name: "Foglark Stube",
      cuisine: "Alpine · North Indian",
      summary: "Fireplace dining at 1,600 m; fondue and tandoor nights.",
      categories: [
        {
          name: "Chef Specials",
          items: [
            { n: "Alpine Truffle Fondue", d: "Gruyère, mountain herbs, bread & pickles", p: 640, cal: 620, allergens: ["dairy", "gluten"], prep: 25, tags: ["chef-special"], emoji: "🫕" },
            { n: "Butter Chicken", d: "Tandoori chicken, tomato-butter gravy, fenugreek", p: 460, cal: 580, diet: "NON_VEG", allergens: ["dairy"], spice: 1, protein: 29, prep: 25, tags: ["chef-special", "high-protein"], addons: [SHARED_ADDONS.extraRice, SHARED_ADDONS.extraRotti], emoji: "🍗" },
            { n: "Rösti & Eggs", d: "Golden potato rosti, fried eggs, chives", p: 340, cal: 460, diet: "EGG", allergens: ["egg"], prep: 18, tags: ["breakfast"], emoji: "🥔" },
          ],
        },
        {
          name: "Indian",
          items: [
            { n: "Dal Tadka + Jeera Rice", d: "Yellow lentils, ghee tempering", p: 260, cal: 380, allergens: ["dairy"], protein: 14, prep: 18, tags: ["healthy"], emoji: "🍛" },
            { n: "Chole Bhature", d: "Spiced chickpeas, leavened bread", p: 300, cal: 620, allergens: ["gluten"], spice: 2, prep: 22, tags: ["spicy"], emoji: "🫓" },
          ],
        },
      ],
    },
    "noir-on-fifth": {
      name: "The Fifth Floor",
      cuisine: "Modern diner · Pan-Asian",
      summary: "Level-5 diner and espresso bar; jazz lounge downstairs.",
      categories: [
        {
          name: "Chinese",
          items: [
            { n: "Dan Dan Noodles", d: "Sesame-chilli oil, minced pork, scallion", p: 430, cal: 540, diet: "NON_VEG", spice: 3, protein: 22, prep: 18, tags: ["spicy", "high-protein"], emoji: "🌶️" },
            { n: "Mapo Tofu", d: "Silken tofu, doubanjiang, sichuan pepper", p: 380, cal: 320, spice: 3, protein: 18, prep: 18, tags: ["spicy", "low-cal"], emoji: "🥡" },
            { n: "Veg Spring Rolls (4)", d: "Sweet chilli dip", p: 240, cal: 280, spice: 1, prep: 12, emoji: "🥟" },
          ],
        },
        {
          name: "Main Course",
          items: [
            { n: "Noir Smash Burger", d: "Double patty, burnt-onion mayo, brioche", p: 480, cal: 680, diet: "NON_VEG", allergens: ["gluten", "dairy", "egg"], protein: 34, prep: 16, tags: ["high-protein"], addons: [SHARED_ADDONS.cheese], emoji: "🍔" },
            { n: "Kung Pao Cauliflower", d: "Peanuts, dried chilli, scallion", p: 360, cal: 300, allergens: ["nuts", "soy"], spice: 2, prep: 18, tags: ["spicy", "low-cal"], diet: "VEGAN", emoji: "🥦" },
          ],
        },
      ],
    },
  };

  const cfg = perHotel[slug];
  return {
    restaurant: {
      name: cfg.name!,
      cuisine: cfg.cuisine!,
      summary: cfg.summary!,
      hours: { breakfast: "07:00–10:30", lunch: "12:00–15:00", dinner: "19:00–23:00" },
    },
    // shared categories first, then hotel-specific ones
    categories: [...cfg.categories!, ...common],
  };
}

const EXPERIENCES: Record<string, Array<{
  name: string; category: string; description: string; distanceKm: number;
  durationHours?: number; priceInr?: number; rating?: number; meetingPoint?: string; emoji: string;
}>> = {
  "the-meridian-lisbon": [
    { name: "Alfama Tile Walk", category: "attractions", description: "Self-guided azulejo trail through the old quarter with a printed map from concierge.", distanceKm: 1.2, durationHours: 2, priceInr: 0, rating: 4.7, meetingPoint: "Hotel lobby", emoji: "🏛️" },
    { name: "Tram 28 Heritage Ride", category: "transportation", description: "Iconic wooden tram loop through Graça and Baixa — queue early.", distanceKm: 0.4, durationHours: 1, priceInr: 320, rating: 4.5, emoji: "🚋" },
    { name: "Time Out Market Tasting", category: "restaurants", description: "Guided tasting across eight stalls with a local food writer.", distanceKm: 1.8, durationHours: 2.5, priceInr: 3100, rating: 4.8, emoji: "🍤" },
    { name: "Sunset Sail on the Tagus", category: "tours", description: "Two-hour vintage schooner cruise past Belém as the light turns gold.", distanceKm: 3.2, durationHours: 2, priceInr: 4200, rating: 4.9, emoji: "⛵" },
  ],
  "casa-solera": [
    { name: "Real Alcázar Priority Entry", category: "museums", description: "Skip-the-line entry to the Mudéjar palace gardens.", distanceKm: 0.9, durationHours: 2, priceInr: 1900, rating: 4.8, emoji: "🏰" },
    { name: "Flamenco in Triana", category: "events", description: "Intimate tablao show with two dancers and a guitarist.", distanceKm: 2.4, durationHours: 1.5, priceInr: 2500, rating: 4.7, emoji: "💃" },
    { name: "Tapas Crawl", category: "restaurants", description: "Four bars, four tapas, one sherries-only stop.", distanceKm: 1.1, durationHours: 3, priceInr: 2800, rating: 4.6, emoji: "🍢" },
    { name: "Plaza de España Rowboats", category: "activities", description: "Half-hour on the canal under the semicircular colonnade.", distanceKm: 1.6, durationHours: 0.5, priceInr: 550, rating: 4.4, emoji: "🚣" },
  ],
  "azure-bay-santorini": [
    { name: "Oia Sunset Watchpoint", category: "attractions", description: "Concierge-reserved spot at the Byzantine castle ramparts, 45 min before sundown.", distanceKm: 0.3, durationHours: 1, priceInr: 0, rating: 4.9, emoji: "🌅" },
    { name: "Caldera Catamaran Swim", category: "tours", description: "Five-hour sail with hot-spring swim and onboard grill lunch.", distanceKm: 4.5, durationHours: 5, priceInr: 6500, rating: 4.8, emoji: "🛥️" },
    { name: "Akrotiri Ruins Visit", category: "museums", description: "Bronze-age city preserved in ash; audio guide included.", distanceKm: 12, durationHours: 2, priceInr: 1200, rating: 4.5, emoji: "🏺" },
    { name: "Assyrtiko Wine Flight", category: "activities", description: "Volcanic-soil whites poured at a cliff-top winery.", distanceKm: 6.8, durationHours: 1.5, priceInr: 2100, rating: 4.6, emoji: "🍷" },
  ],
  "foglark-lodge": [
    { name: "Sunrise Gornergrat Train", category: "tours", description: "First cogwheel train up for Matterhorn alpenglow.", distanceKm: 0.8, durationHours: 3, priceInr: 7400, rating: 4.9, emoji: "🚞" },
    { name: "Guided Snowshoe Hike", category: "activities", description: "Two-hour forest loop with a mountain guide, hot chocolate stop.", distanceKm: 1.5, durationHours: 2, priceInr: 3200, rating: 4.7, meetingPoint: "Hotel boot room", emoji: "❄️" },
    { name: "Alpine Spa Circuit", category: "activities", description: "Hydrotherapy circuit and herbal sauna at the village bathhouse.", distanceKm: 0.6, durationHours: 2.5, priceInr: 2400, rating: 4.6, emoji: "💆" },
    { name: "Cheese-Making Workshop", category: "activities", description: "Morning at an alpage dairy; take your wheel home aged.", distanceKm: 9.2, durationHours: 3, priceInr: 4100, rating: 4.8, emoji: "🧀" },
  ],
  "noir-on-fifth": [
    { name: "Bryant Park Reading Room", category: "attractions", description: "Open-air library shelves behind the NYPL, blocks away.", distanceKm: 0.7, durationHours: 1, priceInr: 0, rating: 4.6, emoji: "📚" },
    { name: "Grand Central Audio Tour", category: "museums", description: "Whispering gallery, celestial ceiling, secret tennis club.", distanceKm: 1.1, durationHours: 1.5, priceInr: 1600, rating: 4.5, emoji: "🚂" },
    { name: "Top of the Rock at Blue Hour", category: "attractions", description: "Timed-entry observation deck as the skyline switches on.", distanceKm: 1.4, durationHours: 1.5, priceInr: 3400, rating: 4.8, emoji: "🌆" },
    { name: "Koreatown BBQ Night", category: "restaurants", description: "Table-grilled short rib feast on 32nd Street.", distanceKm: 0.9, durationHours: 2, priceInr: 4800, rating: 4.4, emoji: "🥩" },
    { name: "Jazz Set Downstairs", category: "events", description: "Late set in our own lobby bar — guests skip the cover.", distanceKm: 0.05, durationHours: 2, priceInr: 0, rating: 4.7, emoji: "🎷" },
  ],
};

async function seedDiningAndExperiences(hotelId: string, slug: string) {
  const catalog = diningCatalog(slug);
  const restaurant = await prisma.restaurant.create({
    data: {
      hotelId,
      hotelKey: hotelId,
      name: catalog.restaurant.name,
      cuisine: catalog.restaurant.cuisine,
      summary: catalog.restaurant.summary,
      hours: JSON.stringify(catalog.restaurant.hours),
      dataProvenance: "demo",
    },
  });
  let order = 0;
  for (const cat of catalog.categories) {
    const category = await prisma.menuCategory.create({
      data: { restaurantId: restaurant.id, name: cat.name, sortOrder: order++ },
    });
    let iOrder = 0;
    for (const it of cat.items) {
      await prisma.menuItem.create({
        data: { ...item(it), restaurantId: restaurant.id, categoryId: category.id, sortOrder: iOrder++ },
      });
    }
  }
  for (const exp of EXPERIENCES[slug] ?? []) {
    await prisma.experience.create({
      data: {
        hotelId,
        hotelKey: hotelId,
        name: exp.name,
        category: exp.category,
        description: exp.description,
        distanceKm: exp.distanceKm,
        durationHours: exp.durationHours ?? null,
        priceInr: exp.priceInr ?? null,
        rating: exp.rating ?? null,
        meetingPoint: exp.meetingPoint ?? null,
        emoji: exp.emoji,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
